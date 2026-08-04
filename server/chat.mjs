// /api/chat 处理器：LLM 流式转发 + 多工具(function calling) 两轮调用
//
// 首轮请求带 tools（当前有 get_weather / query_items）：模型可自行决定何时调用工具。
// 若模型决定调用 → 本服务端执行对应工具 → 把结果作为 tool 消息回填 →
// 做第二轮（不带 tools）请求，把最终自然语言回答流式回前端。前端零改动。
import { BASE, KEY, MODEL, TEMP, proxyAgent, pooledAgent } from './config.mjs'
import { readBody, sse, readSSEStream, createLeadingTrimmer, fetchWithTimeout } from './httpUtils.mjs'
import { fetchWeather, WEATHER_TOOL } from './weather.mjs'
import { fetchItems, ITEMS_TOOL } from './items.mjs'

// 当前启用的工具定义（首轮随请求下发，供模型决策）
const TOOL_DEFS = [WEATHER_TOOL, ITEMS_TOOL]

// 常见城市名（用于从用户消息里抽取天气查询的城市，命中即服务端预取，跳过「工具二轮」）
const CITIES = [
  '北京', '上海', '广州', '深圳', '杭州', '成都', '武汉', '南京', '西安', '重庆', '天津',
  '苏州', '青岛', '厦门', '长沙', '郑州', '济南', '合肥', '昆明', '大连', '宁波', '福州',
  '哈尔滨', '沈阳', '长春', '石家庄', '太原', '南昌', '贵阳', '南宁', '兰州', '海口', '三亚',
  '香港', '澳门', '台北',
  '东京', '大阪', '伦敦', '纽约', '巴黎', '新加坡', '首尔', '悉尼', '洛杉矶', '温哥华', '多伦多',
]
const CITY_RE = new RegExp(`(${CITIES.join('|')})`)
// 天气意图关键词（命中则在服务端预取天气并注入上下文，省掉一轮 LLM 往返，压低 Vercel Hobby 10s 超时风险）
const WEATHER_INTENT_RE = /天气|气温|温[度差]|下雨|下雪|带伞|冷吗|热吗|降温|升温|台风|湿度|风速|几度|多少度|weather|temperature/i
// 商品/服务意图关键词（命中则在服务端预取商品清单并注入上下文，省掉一轮 LLM 往返）
const ITEMS_INTENT_RE = /商品|清单|报价|怎么收费|收费标准|特价|优惠|能提供(什么|哪些)|有什么(服务|业务|商品|东西)|有哪些(服务|商品)|价格(多少|怎么算|表)|想(咨询|了解|问).*(服务|业务)/i

// 工具执行器：name → async (args) => resultObj
// 在 handleChat 内按请求上下文（如用户位置 location）闭包构造。
function buildRunners(location) {
  return {
    [WEATHER_TOOL.function.name]: (args) => fetchWeather({ ...args, location }, pooledAgent),
    [ITEMS_TOOL.function.name]: (args) => fetchItems(args, pooledAgent),
  }
}

// 统一上游聊天补全请求（OpenAI 兼容），返回 fetch Response
async function callUpstream(messages, withTools, toolDefs = TOOL_DEFS) {
  return fetchWithTimeout(
    `${BASE.replace(/\/$/, '')}/chat/completions`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: TEMP,
        stream: true,
        ...(withTools ? { tools: toolDefs, tool_choice: 'auto' } : {}),
      }),
      // 仅上游 LLM 请求走代理，不影响本地 /api
      dispatcher: proxyAgent || undefined,
    },
    25000,
  )
}

// 转发一条 SSE data 给前端，仅对 delta.content 做「前导空白剥离」（流式安全），
// 其余字段（role / tool_calls 等）原样透传，不改动 JSON 结构（前端仍按
// choices[0].delta.content 解析）。
function writeTrimmed(res, json, trimmer) {
  const d = json?.choices?.[0]?.delta
  if (d && typeof d.content === 'string') {
    const c = trimmer(d.content)
    // 仍在前导空白阶段（已吞、尚未见正文）→ 不发空行
    if (c === '' && d.content !== '') return
    const nd = { ...d, content: c }
    const njson = { ...json, choices: [{ ...json.choices[0], delta: nd }] }
    res.write(`data: ${JSON.stringify(njson)}\n\n`)
    return
  }
  res.write(`data: ${JSON.stringify(json)}\n\n`)
}

export async function handleChat(req, res) {
  // 1) 解析请求体
  let payload = {}
  try {
    payload = JSON.parse(await readBody(req))
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: '请求体不是合法 JSON' }))
    return
  }

  // 用户位置（浏览器定位授权后由前端传入，仅用于天气兜底，不进对话）
  const location = payload.location || null
  const runners = buildRunners(location)

  // 天气意图预判 + 服务端预取：命中则把天气摘要注入系统提示词，并去掉首轮天气工具，
  // 让模型直接作答、跳过「工具二轮」——把整体耗时从「LLM1+天气+LLM2」压到「天气+LLM1」，
  // 避免超过 Vercel Hobby 10s 函数上限被静默腰斩（表现为「问天气没返回」）。
  const lastUserMsg = (payload.messages || []).filter((m) => m.role === 'user').slice(-1)[0]
  const weatherIntent = !!lastUserMsg && WEATHER_INTENT_RE.test(lastUserMsg.content || '')
  let weatherContext = ''
  let round1Tools = TOOL_DEFS
  if (weatherIntent) {
    const cityMatch = (lastUserMsg.content || '').match(CITY_RE)
    const wArgs = cityMatch ? { city: cityMatch[1] } : location ? { location } : null
    if (wArgs) {
      try {
        const w = await fetchWeather(wArgs)
        if (w.ok) {
          weatherContext = `\n[系统天气上下文，请据此直接回答用户，不要再调用天气工具] ${w.summary}`
          round1Tools = TOOL_DEFS.filter((t) => t.function.name !== WEATHER_TOOL.function.name)
        }
      } catch {
        /* 预取失败 → 保留天气工具，回退到原二轮路径 */
      }
    }
  }

  // 商品意图预判 + 服务端预取（与天气对称）：命中则把商品清单摘要注入系统提示词，
  // 并去掉首轮 query_items 工具，让模型直接作答、跳过「工具二轮」，
  // 把整体耗时从「LLM1+商品+LLM2」压到「商品+LLM1」，规避 Vercel Hobby 10s 腰斩
  // （表现为「问商品没返回 / 没获取到」）。
  const itemsIntent = !!lastUserMsg && ITEMS_INTENT_RE.test(lastUserMsg.content || '')
  let itemsContext = ''
  if (itemsIntent) {
    try {
      const it = await fetchItems({}, pooledAgent)
      if (it.ok) {
        itemsContext = `\n[系统商品/服务上下文，请据此直接回答用户，不要再调用商品工具] ${it.summary}`
        round1Tools = round1Tools.filter((t) => t.function.name !== ITEMS_TOOL.function.name)
      }
    } catch {
      /* 预取失败 → 保留商品工具，回退到原二轮路径 */
    }
  }

  const sysExtra = [weatherContext, itemsContext].filter(Boolean).join('\n')
  const llm1Messages = (payload.messages || []).map((m, i) =>
    i === 0 && m.role === 'system' && sysExtra ? { ...m, content: m.content + sysExtra } : m,
  )

  // 2) 未配置 → 友好错误（走 SSE 通道，前端统一解析）
  if (!BASE || !KEY || !MODEL) {
    res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8' })
    sse(res, {
      error: '服务端未配置 LLM：请在项目根 .env 设置 LLM_BASE_URL / LLM_API_KEY / LLM_MODEL（参考 .env.example）',
    })
    sse(res, '[DONE]')
    res.end()
    return
  }

  try {
    // 3) 首轮：带 tools，流式转发同时采集工具调用
    const upstream = await callUpstream(llm1Messages, true, round1Tools)
    if (!upstream.ok) {
      const errText = await upstream.text()
      res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8' })
      sse(res, { error: `模型服务返回 ${upstream.status}：${errText.slice(0, 240)}` })
      sse(res, '[DONE]')
      res.end()
      return
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    })

    const toolCalls = []
    let hasToolCall = false
    const trimmer = createLeadingTrimmer()
    await readSSEStream(upstream.body, (json) => {
      const delta = json.choices?.[0]?.delta
      // 收集工具调用片段（按 index 拼接 id / name / arguments）
      if (delta?.tool_calls) {
        hasToolCall = true
        for (const tc of delta.tool_calls) {
          const idx = tc.index ?? 0
          if (!toolCalls[idx]) toolCalls[idx] = { id: '', name: '', args: '' }
          if (tc.id) toolCalls[idx].id = tc.id
          if (tc.function?.name) toolCalls[idx].name += tc.function.name
          if (tc.function?.arguments) toolCalls[idx].args += tc.function.arguments
        }
      }
      // 工具调用行不透传前端，避免暴露工具 JSON；其余普通内容行实时转发（剥离前导空白）
      if (!delta?.tool_calls) writeTrimmed(res, json, trimmer)
    })

    // 4) 无工具调用 → 首轮即为最终回答，直接结束
    if (!hasToolCall) {
      res.end()
      return
    }

    // 5) 依次执行模型决定的每个工具调用（通常一个，但支持多个）
    const toolResults = []
    for (const t of toolCalls.filter(Boolean)) {
      const runner = runners[t.name]
      let content
      if (runner) {
        try {
          const a = JSON.parse(t.args || '{}')
          content = JSON.stringify(await runner(a))
        } catch (e) {
          content = JSON.stringify({
            ok: false,
            error: `工具参数解析失败：${e?.message || String(e)}`,
          })
        }
      } else {
        content = JSON.stringify({ ok: false, error: `未知工具：${t.name}` })
      }
      toolResults.push({ role: 'tool', tool_call_id: t.id, content })
    }

    // 6) 组装第二轮消息：原历史 + 助手工具调用回执(全部) + 各工具结果(逐个)
    const assistantToolMsg = {
      role: 'assistant',
      tool_calls: toolCalls.filter(Boolean).map((t) => ({
        id: t.id,
        type: 'function',
        function: { name: t.name, arguments: t.args },
      })),
    }
    const secondMessages = [
      ...(payload.messages || []),
      assistantToolMsg,
      ...toolResults,
    ]

    // 7) 第二轮：不带 tools，取最终自然语言回答流式回前端
    const upstream2 = await callUpstream(secondMessages, false)
    if (!upstream2.ok) {
      const errText = await upstream2.text()
      sse(res, { error: `模型服务返回 ${upstream2.status}：${errText.slice(0, 240)}` })
      sse(res, '[DONE]')
      res.end()
      return
    }
    await readSSEStream(upstream2.body, (json) => {
      writeTrimmed(res, json, trimmer)
    })
    res.end()
  } catch (e) {
    // 上游网络错误：附上常见原因提示，便于排障
    const code = e?.cause?.code || e?.code || ''
    const msg = e.message || String(e)
    const hint = /ENOTFOUND|EAI_NONAME|getaddrinfo|ECONNREFUSED/.test(code + msg)
      ? '（域名无法解析或连接被拒：可能是内网/VPN 专属地址、需连对应网络，或 BASE_URL 拼写有误）'
      : /ECONNRESET|fetch failed|certificate|SSL/.test(code + msg)
      ? '（连接被重置/证书错误：上游可能被墙、需代理访问，或需设置 LLM_PROXY）'
      : ''
    // 若响应头尚未发出（如首轮 upstream 调用即抛错）→ 正常以 200 + SSE 错误帧返回；
    // 若已在流式途中（上游连接中途断开）→ 头已发，只能追加一条 error 事件，不能再 writeHead
    //   （否则 Node 抛 ERR_HTTP_HEADERS_SENT）。前端 useChat 会捕获并走 onError。
    if (!res.headersSent) {
      res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8' })
    }
    sse(res, { error: `代理请求上游失败：${msg} ${hint}` })
    sse(res, '[DONE]')
    res.end()
  }
}
