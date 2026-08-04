// Vercel Serverless Function：GET /api/health
import { setCORS } from '../server/httpUtils.mjs'
import { ALLOWED_ORIGINS, BASE, MODEL } from '../server/config.mjs'

export default async function handler(req, res) {
  setCORS(res, req, ALLOWED_ORIGINS)
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ ok: true, configured: !!(BASE && MODEL) }))
}
