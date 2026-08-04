// Vercel Serverless Function：GET /api/model
// 服务端代理：用签名密钥向 fastapi-web 换一个限时签名 URL，再 302 把浏览器跳去直连拉取。
//
// 为什么这样设计：
//   - 14.5MB 的 VRM 若经本函数下载再回传，会撞上 Vercel 函数 4.5MB 响应体上限（413）；
//     故本函数只换一个 5 分钟有效的签名 URL，浏览器再直连 api.erishen.cn 拉大文件。
//   - 主密钥 MODEL_SIGN_SECRET 只存在于 Vercel 环境变量，永不进浏览器 bundle；
//     浏览器最终拿到的只是带 sig/exp 的限时签名 URL。
//   - 原始模型地址不再可裸链（需有效签名），CORS 仍由 fastapi-web 提供（d319701 已修）。
import { setCORS } from '../server/httpUtils.mjs'

const BASE = process.env.MODEL_SIGN_BASE || 'https://api.erishen.cn'
const SECRET = process.env.MODEL_SIGN_SECRET || ''

// 仅换签名 URL，不涉及大文件传输，10s 足够；Hobby 默认即 10s。
export const config = {
  maxDuration: 10,
}

export default async function handler(req, res) {
  setCORS(res, req, 'https://firefly.erishen.cn')
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }
  if (!SECRET) {
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
      res.statusCode = 502
      res.end(`签名换发失败: ${r.status}`)
      return
    }
    const { url } = await r.json()
    res.setHeader('Location', url)
    res.statusCode = 302
    res.end()
  } catch (e) {
    res.statusCode = 502
    res.end('签名服务调用异常')
  }
}
