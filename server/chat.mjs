// /api/chat 处理器：LLM 流式转发 + 多工具(function calling) 两轮调用
//
// 首轮请求带 tools（当前有 get_weather / query_items）：模型可自行决定何时调用工具。
// 若模型决定调用 → 本服务端执行对应工具 → 把结果作为 tool 消息回填 →
// 做第二轮（不带 tools）请求，把最终自然语言回答流式回前端。前端零改动。
import { BASE, KEY, MODEL, TEMP, proxyAgent } from './config.mjs'
import { readBody, sse, readSSEStream, createLeadingTrimmer } from './httpUtils.mjs'
import { fetchWeather, WEATHER_TOOL } from './weather.mjs'
import { fetchItems, ITEMS_TOOL } from './items.mjs'

// 当前启用的工具定义（首轮随请求下发，供模型决策）
const TOOL_DEFS = [WEATHER_TOOL, ITEMS_TOOL]

// 工具执行器：name → async (args) => resultObj
// 在 handleChat 内按请求上下文（如用户位置 location）闭包构造。
function buildRunners(location) {
  return {
    [WEATHER_TOOL.function.name]: (args) => fetchWeather({ ...args, location }, proxyAgent),
    [ITEMS_TOOL.function.name]: (args) => fetchItems(args, proxyAgent),
  }
}

// 统一上游聊天补全请求（OpenAI 兼容），返回 fetch Response
async function callUpstream(messages, withTools) {
  return fetch(`${BASE.replace(/\/$/, '')}/chat/completions`, {
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
      ...(withTools ? { tools: TOOL_DEFS, tool_choice: 'auto' } : {}),
    }),
    // 仅上游 LLM 请求走代理，不影响本地 /api
    dispatcher: proxyAgent || undefined,
  })
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
    const upstream = await callUpstream(payload.messages || [], true)
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
    res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8' })
    sse(res, { error: `代理请求上游失败：${msg} ${hint}` })
    sse(res, '[DONE]')
    res.end()
  }
}
