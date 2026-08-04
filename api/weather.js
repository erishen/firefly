// Vercel Serverless Function：GET /api/weather?city=北京
import { setCORS } from '../server/httpUtils.mjs'
import { ALLOWED_ORIGINS } from '../server/config.mjs'
import { fetchWeather } from '../server/weather.mjs'
import { logUsage } from '../server/logUsage.mjs'

export const config = { api: { bodyParser: true } }

export default async function handler(req, res) {
  setCORS(res, req, ALLOWED_ORIGINS)
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }
  await logUsage(req, res, { endpoint: 'weather' })
  const url = new URL(req.url, 'http://localhost')
  const city = (url.searchParams.get('city') || '').trim()
  if (!city) {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: false, error: '缺少 city 参数，例如 /api/weather?city=北京' }))
    return
  }
  const r = await fetchWeather({ city })
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(r))
}
