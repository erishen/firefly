// GET /api/stats
// 受保护的使用统计汇总：累计独立访客 / 今日各功能调用次数 / 国家 Top10 / 近 7 日趋势。
// 鉴权：Authorization: Bearer <STATS_API_KEY>（STATS_API_KEY 在 Vercel 环境变量配置）。
// 未配置 STATS_API_KEY 时一律 401，避免未授权暴露数据。
import { getSupabase, missingSupabaseEnv } from '../server/supabase.mjs'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.writeHead(405, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Method Not Allowed' }))
    return
  }

  const expected = process.env.STATS_API_KEY
  const m = /^Bearer\s+(.+)$/i.exec(req.headers['authorization'] || '')
  const provided = m ? m[1] : ''
  if (!expected || provided !== expected) {
    res.writeHead(401, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Unauthorized' }))
    return
  }

  const supabase = await getSupabase()
  if (!supabase) {
    const diag = missingSupabaseEnv()
    res.writeHead(503, { 'Content-Type': 'application/json' })
    res.end(
      JSON.stringify({
        error: 'Supabase not configured',
        missing: diag.missing,
        availableRelatedKeys: diag.availableRelatedKeys,
        hint: '把 availableRelatedKeys 里的真实变量名贴给我即可精确适配；或确认 Supabase 绑定已注入变量并 Redeploy',
      }),
    )
    return
  }

  try {
    const { data, error } = await supabase.rpc('usage_stats')
    if (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: error.message }))
      return
    }
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    })
    res.end(JSON.stringify(data, null, 2))
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: e?.message || String(e) }))
  }
}
