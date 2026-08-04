// Vercel Serverless Function：POST /api/chat
// 直接复用 server/chat.mjs 的 handleChat —— 它是标准 Node (req, res) 风格，
// 与 Vercel Node 函数签名一致，无需改造即可跑流式 SSE。
import { setCORS } from '../server/httpUtils.mjs'
import { ALLOWED_ORIGINS } from '../server/config.mjs'
import { handleChat } from '../server/chat.mjs'
import { logUsage } from '../server/logUsage.mjs'

// 关闭 Vercel 默认 body 解析，改由 handleChat 自行读取原始流（流式 SSE 必需）。
// maxDuration：Hobby 计划上限 10s；若需更长（慢模型 / 工具两轮调用）请升级 Pro 计划
//   （Pro 支持到 60s/300s，届时把本值调大即可）。
export const config = {
  api: { bodyParser: false },
  maxDuration: 10,
}

export default async function handler(req, res) {
  setCORS(res, req, ALLOWED_ORIGINS)
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }
  await logUsage(req, res, { endpoint: 'chat', ok: true })
  await handleChat(req, res)
}
