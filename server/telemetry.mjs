// 模型加载遥测（隐私安全）
// 记录「VRM 模型是否加载成功 + 耗时」，用于监控加载健康度。
// 绝不记录：聊天内容、LLM Key / 代理凭证、用户真实 IP、浏览器 UA、身份。
// 记录字段：ts（时间）/ ok（是否成功）/ ms（加载耗时毫秒）/ from_cache（是否命中浏览器缓存）/
//   url（模型地址，已去查询串，避免泄露签名）/ error（失败原因，截断）/
//   country（国家代码，来自 x-vercel-ip-country）/ anon（ff_sid 匿名会话 ID）
// 存储（多路，均失败不影响主流程）：
//   1) Vercel 函数标准输出 → 实时可见（Dashboard / `vercel logs`）
//   2) Upstash Redis 列表 `firefly:model_loads`（若配置）
//   3) Supabase 表 `model_loads`（若配置；service_role 绕过 RLS）
import { getRedis, getAnonSid } from './logUsage.mjs'

const REDIS_LIST_KEY = 'firefly:model_loads'
const REDIS_MAX_LEN = 10000

export async function logModelLoad(req, res, { ok, ms, fromCache, url, error } = {}) {
  let anon
  let country
  try {
    anon = getAnonSid(req, res)
    country = (req.headers['x-vercel-ip-country'] || 'local').toUpperCase()
  } catch {
    return // 连 cookie 都读不出就不记录，绝不阻塞主流程
  }

  const row = {
    ts: new Date().toISOString(),
    ok: !!ok,
    ms: typeof ms === 'number' && isFinite(ms) ? Math.max(0, Math.round(ms)) : null,
    from_cache: !!fromCache,
    // 去掉查询串，避免把模型签名 URL 的凭证写进日志 / 数据库
    url: typeof url === 'string' ? url.split('?')[0].slice(0, 256) : null,
    error: typeof error === 'string' ? error.slice(0, 512) : null,
    country,
    anon,
  }

  // 1) 标准输出（实时可见，无需 Supabase 即可监控）
  console.log(`[model-load] ${JSON.stringify(row)}`)

  // 2) + 3) 多路落盘：Upstash Redis 与 Supabase 并行写入，任一路失败静默跳过
  try {
    const { getSupabase } = await import('./supabase.mjs')
    const [redis, supabase] = await Promise.all([getRedis(), getSupabase()])
    const tasks = []
    if (redis) {
      tasks.push(
        redis
          .lpush(REDIS_LIST_KEY, JSON.stringify(row))
          .then(() => redis.ltrim(REDIS_LIST_KEY, 0, REDIS_MAX_LEN - 1).catch(() => {}))
      )
    }
    if (supabase) {
      tasks.push(
        supabase
          .from('model_loads')
          .insert(row)
          .then(({ error: e }) => {
            if (e) console.warn('[model-load] supabase insert failed:', e.message)
          })
      )
    }
    await Promise.allSettled(tasks)
  } catch {
    // 存储未配置 / 网络失败：静默跳过
  }
}
