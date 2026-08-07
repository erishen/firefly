// 服务端 Supabase 客户端（懒加载，仅在配置了 env 时实例化）。
// 优先 SUPABASE_SERVICE_ROLE_KEY（绕过 RLS）；缺失时回退 SUPABASE_ANON_KEY
// （usage_events 表未启用 RLS，anon key 读写等价，可让 Vercel Supabase 集成「只注入
// url+anon」时也能直接工作，免去手动复制 service_role）。两者都不暴露到前端。
//
// 变量名兼容两种来源：
//   1) 标准名：SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY
//   2) Vercel Supabase 集成（命名实例）注入的前缀名：FIREFLY_SUPABASE_URL /
//      FIREFLY_SUPABASE_ANON_KEY / FIREFLY_SUPABASE_SERVICE_ROLE_KEY
let supabasePromise = null

// 按候选顺序取第一个非空的环境变量
function pick(...candidates) {
  for (const c of candidates) {
    if (process.env[c]) return process.env[c]
  }
  return undefined
}

export function getSupabase() {
  if (supabasePromise) return supabasePromise
  supabasePromise = (async () => {
    const url = pick('SUPABASE_URL', 'FIREFLY_SUPABASE_URL')
    // service_role 优先；缺失则回退 anon（两种前缀都试）
    const key = pick(
      'SUPABASE_SERVICE_ROLE_KEY',
      'FIREFLY_SUPABASE_SERVICE_ROLE_KEY',
      'SUPABASE_ANON_KEY',
      'FIREFLY_SUPABASE_ANON_KEY',
    )
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
  const url = pick('SUPABASE_URL', 'FIREFLY_SUPABASE_URL')
  const key = pick(
    'SUPABASE_SERVICE_ROLE_KEY',
    'FIREFLY_SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_ANON_KEY',
    'FIREFLY_SUPABASE_ANON_KEY',
  )
  const missing = []
  if (!url) missing.push('SUPABASE_URL (或 FIREFLY_SUPABASE_URL)')
  if (!key)
    missing.push(
      'SUPABASE_SERVICE_ROLE_KEY/SUPABASE_ANON_KEY (或 FIREFLY_SUPABASE_* 变体)',
    )
  return missing
}
