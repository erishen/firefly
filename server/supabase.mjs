// 服务端 Supabase 客户端（懒加载，仅在配置了 env 时实例化）。
// 使用 SUPABASE_SERVICE_ROLE_KEY → 绕过 RLS，仅限可信服务端使用，切勿暴露到前端。
let supabasePromise = null

export function getSupabase() {
  if (supabasePromise) return supabasePromise
  supabasePromise = (async () => {
    const url = process.env.SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) return null
    const { createClient } = await import('@supabase/supabase-js')
    return createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  })()
  return supabasePromise
}
