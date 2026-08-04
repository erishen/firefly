// HTTP 通用工具：CORS、读取请求体、写 SSE、解析上游 SSE 流
// 与具体业务（聊天 / 天气）无关，可跨模块复用。

// 给响应加 CORS 头。
// 白名单模式：allowedStr 为空时仅允许本地开发源；否则按逗号分隔的源精确匹配，
// 命中才回写该 Origin（不能用 *，否则任意网站都能盗用你的 LLM Key 调 /api/chat）。
// 未命中白名单的跨域请求：不加任何 CORS 头 → 浏览器自动拒绝（等同封禁）。
const DEV_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:8787',
  'http://localhost:8787',
]
export function setCORS(res, req, allowedStr = '') {
  const origin = req?.headers?.origin
  let allowed = (allowedStr || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (allowed.length === 0) allowed = DEV_ORIGINS

  let allowOrigin = ''
  if (allowed.includes('*')) {
    allowOrigin = '*' // 显式允许通配（仅本地调试用，部署勿设）
  } else if (origin && allowed.includes(origin)) {
    allowOrigin = origin // 精确命中，回写该源（不泄露其他源）
  }
  if (!allowOrigin) return

  res.setHeader('Access-Control-Allow-Origin', allowOrigin)
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

// 读取请求体为字符串
export function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (c) => (data += c))
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

// 向前端写一条 SSE 数据行
export function sse(res, obj) {
  res.write(`data: ${JSON.stringify(obj)}\n\n`)
}

// 逐行解析上游 SSE 流（text/event-stream），对每个 data JSON 调用 cb(json)。
// 跳过 [DONE]。供聊天流式转发 / 工具调用采集复用。
//   body: fetch 响应的 ReadableStream
//   cb(jsonObj): 处理单个解析后的 SSE data 对象
export async function readSSEStream(body, cb) {
  const rd = body.getReader()
  const dc = new TextDecoder()
  let b = ''
  while (true) {
    const { done, value } = await rd.read()
    if (done) break
    b += dc.decode(value, { stream: true })
    let nl
    while ((nl = b.indexOf('\n')) >= 0) {
      const line = b.slice(0, nl).trim()
      b = b.slice(nl + 1)
      if (!line.startsWith('data:')) continue
      const data = line.slice(5).trim()
      if (data === '[DONE]') continue
      let json
      try {
        json = JSON.parse(data)
      } catch {
        continue
      }
      cb(json)
    }
  }
}

// 流式安全的前导空白剥离工厂。
// 调用方按到达顺序传入增量文本片段；在尚未见到任何非空白字符之前，
// 若累积内容整体仍是空白则返回 ''（吞掉，不发空行）；一旦遇到首个非空白字符，
// 一次性返回「去掉前导空白后的累积剩余」，此后原样透传。
// 用途：很多 LLM 在 content 首个 token 就是 \n\n，直接透传会让气泡/记录开头出现一堆空行。
export function createLeadingTrimmer() {
  let seen = false
  let buf = ''
  return (text) => {
    if (seen) return text
    buf += text || ''
    if (/^\s*$/.test(buf)) return ''
    seen = true
    const out = buf.replace(/^\s+/, '')
    buf = ''
    return out
  }
}

// 带超时的 fetch 封装：防止上游（Open-Meteo / api.erishen.cn / LLM 网关）挂起无响应，
// 拖垮整个 /api/chat（本地会卡死、Vercel 上会触发函数 504 被腰斩）。
//   url   目标地址
//   opts  fetch 选项（可含 undici 的 dispatcher 走代理）
//   ms    超时毫秒，默认 8000
// 返回 fetch Response；超时抛 AbortError（调用方可在 catch 用 e.name === 'AbortError' 识别）
export async function fetchWithTimeout(url, opts = {}, ms = 8000) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal })
  } finally {
    clearTimeout(timer)
  }
}
