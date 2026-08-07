// 服务端 Supabase 客户端（懒加载，仅在配置了 env 时实例化）。
// 优先 SUPABASE_SERVICE_ROLE_KEY（绕过 RLS）；缺失时回退 SUPABASE_ANON_KEY
// （usage_events 表未启用 RLS，anon key 读写等价）。两者都不暴露到前端。
//
// 变量名兼容多种来源（避免盲猜失败）：
//   1) 标准名：SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY
//   2) Vercel Supabase 集成（命名实例）注入的前缀名：FIREFLY_SUPABASE_URL 等
//   3) 兜底：扫描所有含 firefly / supabase 的变量，自动挑出「值像 URL」和「值像 Key」的
let supabasePromise = null

// 按候选顺序取第一个非空的环境变量
function pick(...candidates) {
  for (const c of candidates) {
    if (process.env[c]) return process.env[c]
  }
  return undefined
}

// 返回所有匹配给定关键字的环境变量「名」（不含值，安全）
function envKeysLike(...patterns) {
  const re = new RegExp(patterns.join('|'), 'i')
  return Object.keys(process.env).filter((k) => re.test(k))
}

// 在所有 firefly/supabase 相关变量里，找值以 http(s):// 开头的（即 URL）
function scanUrl() {
  for (const k of envKeysLike('firefly', 'supabase')) {
    const v = process.env[k] || ''
    if (/^https?:\/\//i.test(v)) return v
  }
  return undefined
}

// 在所有 firefly/supabase 相关变量里，优先挑 anon/service_role/api_key（排除 url/jwt/secret 等）
function scanKey() {
  const keys = envKeysLike('firefly', 'supabase').filter(
    (k) =>
      /(anon|service_role|api_key|_key$)/i.test(k) &&
      !/url|host|db|password|port|database|jwt|secret/i.test(k),
  )
  for (const k of keys) {
    const v = process.env[k] || ''
    if (v.length > 20) return v
  }
  return undefined
}

export function getSupabase() {
  if (supabasePromise) return supabasePromise
  supabasePromise = (async () => {
    const url = pick('SUPABASE_URL', 'FIREFLY_SUPABASE_URL') || scanUrl()
    // service_role 优先；缺失则回退 anon；再不行扫描兜底
    const key =
      pick(
        'SUPABASE_SERVICE_ROLE_KEY',
        'FIREFLY_SUPABASE_SERVICE_ROLE_KEY',
        'SUPABASE_ANON_KEY',
        'FIREFLY_SUPABASE_ANON_KEY',
      ) || scanKey()
    if (!url || !key) return null
    const { createClient } = await import('@supabase/supabase-js')
    return createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  })()
  return supabasePromise
}

// 供诊断：返回缺失说明 + 当前所有相关变量名（不含值），便于在 /api/stats 的 503 里定位真名
export function missingSupabaseEnv() {
  const url = pick('SUPABASE_URL', 'FIREFLY_SUPABASE_URL') || scanUrl()
  const key =
    pick(
      'SUPABASE_SERVICE_ROLE_KEY',
      'FIREFLY_SUPABASE_SERVICE_ROLE_KEY',
      'SUPABASE_ANON_KEY',
      'FIREFLY_SUPABASE_ANON_KEY',
    ) || scanKey()
  const missing = []
  if (!url) missing.push('未找到 SUPABASE_URL / FIREFLY_SUPABASE_URL 或任何 firefly/supabase 前缀的 URL 变量')
  if (!key) missing.push('未找到任何 firefly/supabase 前缀的 Key 变量')
  return {
    missing,
    availableRelatedKeys: envKeysLike('firefly', 'supabase'),
  }
}
