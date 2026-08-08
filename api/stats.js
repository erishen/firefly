// GET /api/stats
// 受保护的使用统计汇总：累计独立访客 / 今日各功能调用次数 / 国家 Top10 / 近 7 日趋势。
// 鉴权：Authorization: Bearer <STATS_API_KEY>（STATS_API_KEY 在 Vercel 环境变量配置）。
// 运行在 Vercel 上时未配置/不匹配一律 401；本地非 Vercel 环境（纯 node / vite 联调）
// 免鉴权，方便先验证接口与数据。
import { getSupabase, missingSupabaseEnv } from '../server/supabase.mjs'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.writeHead(405, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Method Not Allowed' }))
    return
  }

  // 本地非 Vercel 环境（如纯 node / vite 本地联调）免鉴权，方便先验证；
  // 任何 Vercel 部署（VERCEL=1）仍强制 Bearer 校验。
  const isVercel = !!process.env.VERCEL
  const expected = process.env.STATS_API_KEY
  const m = /^Bearer\s+(.+)$/i.exec(req.headers['authorization'] || '')
  const provided = m ? m[1] : ''
  if (isVercel && (!expected || provided !== expected)) {
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
    const [{ data, error }, ml] = await Promise.all([
      supabase.rpc('usage_stats'),
      Promise.resolve(supabase.rpc('model_load_stats')).catch((e) => ({ data: null, error: e })),
    ])
    if (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: error.message }))
      return
    }
    const out = { ...data }
    if (ml && !ml.error && ml.data) out.model_loads = ml.data
    else if (ml && ml.error) out.model_loads = { error: ml.error.message }
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    })
    res.end(JSON.stringify(out, null, 2))
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: e?.message || String(e) }))
  }
}
