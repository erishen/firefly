// POST /api/telemetry
// 前端遥测上报（当前支持 type=model_load）。无鉴权（个人站点监控用途），
// 仅接受已知 type 与受限字段，并对 body 大小设上限，避免被滥用写入。
import { logModelLoad } from '../server/telemetry.mjs'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Method Not Allowed' }))
    return
  }

  let body
  try {
    body = await readJson(req, 1e5)
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Invalid body' }))
    return
  }

  const { type, ok, ms, fromCache, url, error } = body || {}
  if (type !== 'model_load') {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Unsupported telemetry type' }))
    return
  }

  // 字段净化：只接受基本类型，杜绝任意对象写入
  await logModelLoad(req, res, {
    ok: Boolean(ok),
    ms: typeof ms === 'number' && isFinite(ms) ? ms : null,
    fromCache: Boolean(fromCache),
    url: typeof url === 'string' ? url : null,
    error: typeof error === 'string' ? error : null,
  })

  res.writeHead(204)
  res.end()
}

function readJson(req, maxBytes) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (c) => {
      data += c
      if (data.length > maxBytes) {
        req.destroy()
        reject(new Error('body too large'))
      }
    })
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {})
      } catch (e) {
        reject(e)
      }
    })
    req.on('error', reject)
  })
}
