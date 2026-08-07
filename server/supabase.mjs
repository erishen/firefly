// 服务端 Supabase 客户端（懒加载，仅在配置了 env 时实例化）。
// 优先 SUPABASE_SERVICE_ROLE_KEY（绕过 RLS）；缺失时回退 SUPABASE_ANON_KEY
// （usage_events 表未启用 RLS，anon key 读写等价，可让 Vercel Supabase 集成「只注入
// url+anon」时也能直接工作，免去手动复制 service_role）。两者都不暴露到前端。
let supabasePromise = null

export function getSupabase() {
  if (supabasePromise) return supabasePromise
  supabasePromise = (async () => {
    const url = process.env.SUPABASE_URL
    // service_role 优先；缺失则回退 anon
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
    if (!url || !key) return null
    const { createClient } = await import('@supabase/supabase-js')
    return createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  })()
  return supabasePromise
}

// 供诊断：返回缺失的环境变量名（不含值），便于在 /api/stats 的 503 里提示用户
export function missingSupabaseEnv() {
  return ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY'].filter(
    (k) => !process.env[k],
  )
}
