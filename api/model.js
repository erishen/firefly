// ⚠️ DEPRECATED / 死代码 —— 勿再调用，下次 Vercel 重新部署前请删除本文件
// ----------------------------------------------------------------------------
// 本 Vercel 函数曾是模型分发的一环：浏览器调 /api/model → 本函数用 MODEL_SIGN_SECRET
// 向 fastapi-web 换限时签名 URL → 302 跳回浏览器直连拉取。
//
// 现状（2026-08-05 重构后）：前端已不再调用本函数。
//   - 生产环境 Stage.jsx 的 FIREFLY_VRM_PROD_URL 直接 CORS 直连
//     https://api.erishen.cn/api/models/fireflyMaid.vrm ；
//   - 后端真实逻辑在 personal/web-services/fastapi-web 的
//     app/routers/protected_files.py（受信来源 OR 限时签名 URL 鉴权）。
//
// 废弃原因：Vercel(hkg1) 到国内 VPS 的服务端出站被拦截/超时，本函数返回 504，
// 导致无痕模式每次都回退默认角色。改为浏览器直连后消除这一跨境 server→server 跳转。
// ----------------------------------------------------------------------------
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
