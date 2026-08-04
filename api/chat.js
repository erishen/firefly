// Vercel Serverless Function：POST /api/chat
// 直接复用 server/chat.mjs 的 handleChat —— 它是标准 Node (req, res) 风格，
// 与 Vercel Node 函数签名一致，无需改造即可跑流式 SSE。
import { setCORS } from '../server/httpUtils.mjs'
import { ALLOWED_ORIGINS } from '../server/config.mjs'
import { handleChat } from '../server/chat.mjs'
import { logUsage } from '../server/logUsage.mjs'

// 关闭 Vercel 默认 body 解析，改由 handleChat 自行读取原始流（流式 SSE 必需）。
// maxDuration：Hobby 计划硬上限 10s（此处设 60 会被自动钳到 10s 但不报错）；
//   若已升级 Pro（支持 60s/300s）本值即生效，可显著缓解「LLM 两轮调用 + 工具」的超时 504。
//   注：本函数含「首轮 LLM + 工具(天气/商品) + 第二轮 LLM」两轮调用，跨洋链路易超 10s。
export const config = {
  api: { bodyParser: false },
  maxDuration: 60,
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
