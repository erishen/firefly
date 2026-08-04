// 服务端配置：.env 解析 + 上游代理探测 + 配置导出
// 集中管理，避免散落在各业务模块。零额外依赖（不引入 dotenv）。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.join(__dirname, '..', '.env')

// 极简 .env 解析（不引入 dotenv 依赖）
function loadEnv(p) {
  const cfg = {}
  try {
    const txt = fs.readFileSync(p, 'utf8')
    for (const line of txt.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m) cfg[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  } catch {
    /* .env 不存在则用空配置，由运行期给出友好提示 */
  }
  return cfg
}

const fileEnv = loadEnv(envPath)
// 配置来源兼容：优先 process.env（Vercel / 容器平台把密钥注入这里），
// 回退到项目根 .env 文件（本地开发）。两者都不存在则为空。
function val(k) {
  return process.env[k] ?? fileEnv[k]
}
export const PORT = Number(val('PORT')) || 8787
export const BASE = val('LLM_BASE_URL') || ''
export const KEY = val('LLM_API_KEY') || ''
export const MODEL = val('LLM_MODEL') || ''
export const TEMP = val('LLM_TEMPERATURE') ? Number(val('LLM_TEMPERATURE')) : 0.8

// 部署期安全项：
//   BIND_HOST —— 监听网卡。默认 127.0.0.1（仅本机），避免 8787 直接暴露公网；
//               部署时由 nginx 反代到 127.0.0.1:8787 即可，无需改。
//   ALLOWED_ORIGINS —— CORS 白名单（逗号分隔）。留空=仅允许本地开发源；
//               部署到公网务必设为前端域名，如 https://firefly.erishen.cn。
//               切勿设为 *（会允许任意网站盗用 LLM Key）。
export const BIND_HOST = val('BIND_HOST') || '127.0.0.1'
export const ALLOWED_ORIGINS = val('ALLOWED_ORIGINS') || ''

// 上游可选走代理：Node 原生 fetch 不读系统 HTTP(S)_PROXY，这里做三级探测：
//   1) .env 的 LLM_PROXY（显式，最高优先级）
//   2) 进程环境变量 HTTPS_PROXY / HTTP_PROXY
//   3) 系统代理（macOS scutil / Linux gsettings）—— 在你本机 Terminal 跑 npm run dev 时通常靠这个
function detectSystemProxy() {
  if (val('LLM_PROXY')) return val('LLM_PROXY')
  const fromEnv =
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy
  if (fromEnv) return fromEnv
  // 系统代理（本机 Terminal 一般不带这些 env，需要读系统配置）
  try {
    if (process.platform === 'darwin') {
      const out = execSync('scutil --proxy', { encoding: 'utf8' })
      const get = (k) => {
        const m = out.match(new RegExp(`${k} : (.+)`))
        return m ? m[1].trim() : ''
      }
      const host = get('HTTPSProxy') || get('HTTPProxy') || get('SOCKSProxy')
      const port = get('HTTPSPort') || get('HTTPPort') || get('SOCKSPort')
      if (host && port) return `http://${host}:${port}`
    } else if (process.platform === 'linux') {
      // 无桌面服务器上 gsettings 通常未安装，stderr 设为 ignore 避免
      // "/bin/sh: gsettings: not found" 噪声（错误本就会被下方 catch 吞掉）
      const host = execSync('gsettings get org.gnome.system.proxy.https host', {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      })
        .trim()
        .replace(/^'|'$/g, '')
      const port = execSync('gsettings get org.gnome.system.proxy.https port', {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim()
      if (host && port && port !== '0') return `http://${host}:${port}`
    }
  } catch {
    /* 读不到系统代理就当没有 */
  }
  return ''
}

export const PROXY = detectSystemProxy()

// 代理 Agent（undici）：供 fetch 上游 LLM / 天气 API 复用。
// 探测不到代理或未安装 undici 时为 null（直连）。
const proxyAgent = await (async () => {
  if (!PROXY) {
    console.warn(
      '[proxy] 未探测到任何上游代理，将直连上游（若上游被墙会 fetch failed；可设 LLM_PROXY 或开启系统代理）',
    )
    return null
  }
  try {
    const { ProxyAgent } = await import('undici')
    // 日志脱敏：若代理地址含 user:pass@，只打印 host:port，避免凭证进日志
    const redacted = PROXY.replace(/\/\/[^@\s]+@/, '//***@')
    console.log(`[proxy] 已启用上游代理：${redacted}`)
    return new ProxyAgent(PROXY)
  } catch {
    console.warn(
      '[proxy] 已探测到代理但未安装 undici，代理不生效（先 npm i undici），将直连上游',
    )
    return null
  }
})()

// 直连环境（Vercel 等无系统代理）用带 keep-alive 的连接池，复用 TLS 连接，
// 减少每次天气/商品请求的建立握手开销（Vercel 函数实例短生命周期，复用能显著提速）。
// 走代理时直接复用 proxyAgent（其自身也带连接池），无需额外 Agent。
const pooledAgent = proxyAgent
  ? proxyAgent
  : await (async () => {
      try {
        const { Agent } = await import('undici')
        return new Agent({
          keepAlive: true,
          keepAliveTimeout: 60_000,
          headersTimeout: 8000,
          bodyTimeout: 8000,
        })
      } catch {
        return null
      }
    })()

export { proxyAgent, pooledAgent }
