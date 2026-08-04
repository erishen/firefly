// 本地 LLM 代理（零依赖，Node 22+ 原生 http/fetch）
// 作用：浏览器只和同源的 /api/chat 通信，真正的 API Key 留在服务端 .env，
// 不进浏览器、不进代码、不进 git。支持 OpenAI 兼容服务的流式(SSE)转发。
//
// 职责拆分：
//   config.mjs   —— .env 解析 + 上游代理探测 + 配置导出
//   httpUtils.mjs—— CORS / 读请求体 / 写 SSE / 解析上游 SSE 流
//   weather.mjs  —— 天气工具（Open-Meteo，免费无 Key）
//   items.mjs    —— 商品查询工具（api.erishen.cn 的 fastapi-web 公开接口）
//   chat.mjs     —— /api/chat 处理（LLM 流式 + 天气/商品多工具调用）
// 本文件只做：HTTP 服务 + 路由分发 + 启动自检。
//
// 配置（项目根 .env，参考 .env.example）：
//   LLM_BASE_URL / LLM_API_KEY / LLM_MODEL / LLM_TEMPERATURE / LLM_PROXY / PORT
//   BIND_HOST（默认 127.0.0.1，仅本机）/ ALLOWED_ORIGINS（CORS 白名单，部署必设）
import http from 'node:http'
import { PORT, BASE, KEY, MODEL, proxyAgent, PROXY, ALLOWED_ORIGINS, BIND_HOST } from './config.mjs'
import { setCORS } from './httpUtils.mjs'
import { fetchWeather } from './weather.mjs'
import { fetchItems } from './items.mjs'
import { handleChat } from './chat.mjs'

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    setCORS(res, req, ALLOWED_ORIGINS)
    res.writeHead(204)
    res.end()
    return
  }
  setCORS(res, req, ALLOWED_ORIGINS)

  const url = new URL(req.url, `http://localhost:${PORT}`)

  // 健康检查 / 配置状态（供前端「测试连接」按钮）
  if (url.pathname === '/api/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, configured: !!(BASE && KEY && MODEL) }))
    return
  }

  // 天气查询（Open-Meteo，免费无 Key）；也可由 LLM 经 get_weather 工具间接调用
  if (url.pathname === '/api/weather' && req.method === 'GET') {
    const city = (url.searchParams.get('city') || '').trim()
    if (!city) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: false, error: '缺少 city 参数，例如 /api/weather?city=北京' }))
      return
    }
    const r = await fetchWeather(city)
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(r))
    return
  }

  // 聊天（含天气/商品等多工具调用，逻辑见 chat.mjs）
  if (url.pathname === '/api/chat' && req.method === 'POST') {
    await handleChat(req, res)
    return
  }

  // 商品查询（api.erishen.cn 的 fastapi-web 公开只读接口）；
  // 也可由 LLM 经 query_items 工具间接调用。用于直接调试与 api.erishen.cn 的连通性。
  if (url.pathname === '/api/items' && req.method === 'GET') {
    const keyword = (url.searchParams.get('keyword') || '').trim()
    const limitRaw = Number(url.searchParams.get('limit') || '20')
    const r = await fetchItems({ keyword, limit: limitRaw })
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(r))
    return
  }

  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'not found' }))
})

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `\n[proxy] 致命：端口 ${PORT} 已被占用！\n` +
        `        通常是上一次未彻底退出的旧代理进程仍占着该端口，\n` +
        `        新代理起不来 → 浏览器/接口访问到的仍是旧代码（可能缺路由，如 /api/items）。\n` +
        `        请先释放端口再重启：\n` +
        `          lsof -ti:${PORT} | xargs kill -9\n` +
        `          npm run dev\n`,
    )
    process.exit(1)
  } else {
    throw err
  }
})

server.listen(PORT, BIND_HOST, () => {
  console.log(`[proxy] LLM 代理已启动 → http://${BIND_HOST}:${PORT}`)
  console.log(
    `[proxy] 配置状态：BASE=${BASE ? '✓' : '✗'} KEY=${KEY ? '✓' : '✗'} MODEL=${MODEL ? '✓' : '✗'}`,
  )
  if (BASE) {
    // 启动自检：探一下上游是否可达，给即时反馈（不阻断服务）
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 8000)
    fetch(`${BASE.replace(/\/$/, '')}/models`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${KEY}` },
      signal: ctrl.signal,
      dispatcher: proxyAgent || undefined,
    })
      .then((r) => {
        clearTimeout(timer)
        // 200/401 都说明网络可达（代理生效）；404 多半是服务不支持 /models 端点
        if (r.ok) console.log('[proxy] 上游连通性自检：✓ 可达')
        else
          console.log(
            `[proxy] 上游连通性自检：${r.status}（网络已通代理生效；该端点可能不返回 /models，不影响聊天）`,
          )
      })
      .catch((e) => {
        clearTimeout(timer)
        const via = proxyAgent ? `（已走代理 ${PROXY}）` : '（未走代理）'
        console.warn(`[proxy] 上游连通性自检失败：${e.message} ${via}`)
        if (!proxyAgent)
          console.warn(
            '[proxy] 提示：上游不可达且未用代理，可能需设置 LLM_PROXY 或开启系统代理后再试',
          )
      })
  }
})
