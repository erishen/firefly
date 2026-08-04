// Vercel Serverless Function：GET /api/items?keyword=咨询&limit=20
import { setCORS } from '../server/httpUtils.mjs'
import { ALLOWED_ORIGINS } from '../server/config.mjs'
import { fetchItems } from '../server/items.mjs'
import { logUsage } from '../server/logUsage.mjs'

export const config = { api: { bodyParser: true } }

export default async function handler(req, res) {
  setCORS(res, req, ALLOWED_ORIGINS)
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }
  await logUsage(req, res, { endpoint: 'items' })
  const url = new URL(req.url, 'http://localhost')
  const keyword = (url.searchParams.get('keyword') || '').trim()
  const limitRaw = Number(url.searchParams.get('limit') || '20')
  const r = await fetchItems({ keyword, limit: limitRaw })
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(r))
}
