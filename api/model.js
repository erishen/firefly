// Vercel Serverless Function：GET /api/model
// 服务端代理：用签名密钥向 fastapi-web 换一个限时签名 URL，再 302 把浏览器跳去直连拉取。
//
// 为什么这样设计：
//   - 14.5MB 的 VRM 若经本函数下载再回传，会撞上 Vercel 函数 4.5MB 响应体上限（413）；
//     故本函数只换一个 5 分钟有效的签名 URL，浏览器再直连 api.erishen.cn 拉大文件。
//   - 主密钥 MODEL_SIGN_SECRET 只存在于 Vercel 环境变量，永不进浏览器 bundle；
//     浏览器最终拿到的只是带 sig/exp 的限时签名 URL。
//   - 原始模型地址不再可裸链（需有效签名），CORS 仍由 fastapi-web 提供（d319701 已修）。
//
// 本函数由浏览器同域调用（firefly.erishen.cn/api/model），不需要 CORS 头。
const BASE = process.env.MODEL_SIGN_BASE || 'https://api.erishen.cn'
const SECRET = process.env.MODEL_SIGN_SECRET || ''

// 仅换签名 URL，不涉及大文件传输，10s 足够；Hobby 默认即 10s。
export const config = {
  maxDuration: 10,
}

export default async function handler(req, res) {
  // 浏览器同域调用，无需 CORS；处理预检即可。
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }
  if (!SECRET) {
    console.error('[api/model] MODEL_SIGN_SECRET 未配置')
    res.statusCode = 500
    res.end('MODEL_SIGN_SECRET 未配置')
    return
  }
  try {
    const r = await fetch(`${BASE}/api/models/sign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SECRET}`,
      },
      body: JSON.stringify({ name: 'fireflyMaid.vrm', base: BASE }),
    })
    if (!r.ok) {
      const text = await r.text().catch(() => '')
      console.error(`[api/model] 签名换发失败: ${r.status}`, text.slice(0, 200))
      res.statusCode = 502
      res.end(`签名换发失败: ${r.status}`)
      return
    }
    const data = await r.json()
    if (!data || !data.url) {
      console.error('[api/model] 签名服务返回异常体:', JSON.stringify(data))
      res.statusCode = 502
      res.end('签名服务返回异常')
      return
    }
    // 不让浏览器缓存这次 302：签名 URL 仅 5 分钟有效，缓存后过期回放会 401
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('Location', data.url)
    res.statusCode = 302
    res.end()
  } catch (e) {
    console.error('[api/model] 签名服务调用异常:', e && e.message ? e.message : e)
    res.statusCode = 502
    res.end('签名服务调用异常')
  }
}
