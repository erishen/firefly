// 匿名使用日志（隐私安全）
// 只记录「有人使用了某个接口」这个事件，绝不记录：
//   - 聊天 / 工具的消息内容
//   - LLM API Key / 代理凭证
//   - 用户真实 IP、浏览器 UA、身份
// 记录字段：ts（时间）/ endpoint（chat|weather|items）/ country（国家代码，
//   来自 Vercel 提供的 x-vercel-ip-country，本地开发为 local）/
//   anon（不透明随机会话 ID，首方 HttpOnly cookie ff_sid，仅用于去重独立访客）/
//   ok（是否成功）
// 存储（多路，均失败不影响主流程）：
//   1) Vercel 函数标准输出 → 实时可见（Dashboard / `vercel logs`）
//   2) Upstash Redis 列表 `firefly:usage` → 持久化、可检索/导出
//      （Vercel Marketplace 的 Upstash Redis 集成，注入 UPSTASH_REDIS_REST_URL/TOKEN）
//   3) Supabase 表 `usage_events` → 关系型、适合 SQL 统计（Vercel Marketplace 集成，
//      注入 SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY；服务端用 service_role 绕过 RLS）
import { randomUUID } from 'node:crypto'
import { getSupabase } from './supabase.mjs'

const SID_COOKIE = 'ff_sid'
const SID_MAX_AGE = 60 * 60 * 24 * 365 // 1 年
const REDIS_LIST_KEY = 'firefly:usage'
const REDIS_MAX_LEN = 10000 // 只保留最近 1 万条，防止列表无限增长

// 懒加载 Upstash Redis：仅当环境变量齐全时才 import + 实例化。
// 否则返回 null → 自动降级为「仅 console 日志」，绝不拖垮主流程。
let redisPromise = null
export function getRedis() {
  if (redisPromise) return redisPromise
  redisPromise = (async () => {
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
      return null
    }
    const { Redis } = await import('@upstash/redis')
    return Redis.fromEnv()
  })()
  return redisPromise
}

// 懒加载 Supabase 服务端客户端见 ./supabase.mjs（本文件仅 import 复用）。

function parseCookies(str) {
  const out = {}
  for (const part of str.split(';')) {
    const i = part.indexOf('=')
    if (i < 0) continue
    const k = part.slice(0, i).trim()
    const v = part.slice(i + 1).trim()
    if (k) out[k] = decodeURIComponent(v)
  }
  return out
}

// 取不透明匿名会话 ID：优先用已有首方 cookie，没有才生成并下发。
// 该 ID 仅用于去重「独立访客」，首方、HttpOnly、不可跨站，不构成第三方追踪。
export function getAnonSid(req, res) {
  const cookies = parseCookies(req.headers.cookie || '')
  let sid = cookies[SID_COOKIE]
  if (!sid || !/^[a-f0-9-]{36}$/.test(sid)) {
    sid = randomUUID()
    res.setHeader(
      'Set-Cookie',
      `${SID_COOKIE}=${sid}; Path=/; Max-Age=${SID_MAX_AGE}; SameSite=Lax; HttpOnly`
    )
  }
  return sid
}

export async function logUsage(req, res, { endpoint, ok = true } = {}) {
  let anon
  let country
  try {
    anon = getAnonSid(req, res)
    country = (req.headers['x-vercel-ip-country'] || 'local').toUpperCase()
  } catch {
    return // 连 cookie 都读不出就不记录，绝不阻塞主流程
  }

  const row = { ts: new Date().toISOString(), endpoint, country, anon, ok }

  // 1) 标准输出（实时可见）
  console.log(`[usage] ${JSON.stringify(row)}`)

  // 2) + 3) 多路落盘：Upstash Redis（list）与 Supabase（表）并行写入，
  //    任一路未配置或失败都静默跳过，绝不阻塞主流程。
  try {
    const [redis, supabase] = await Promise.all([getRedis(), getSupabase()])
    const tasks = []
    if (redis) {
      // lpush 头插，index 0 最新
      tasks.push(
        redis
          .lpush(REDIS_LIST_KEY, JSON.stringify(row))
          // 控制列表长度，避免无限增长（保留前 REDIS_MAX_LEN 条）
          .then(() => redis.ltrim(REDIS_LIST_KEY, 0, REDIS_MAX_LEN - 1).catch(() => {}))
      )
    }
    if (supabase) {
      tasks.push(
        supabase
          .from('usage_events')
          .insert(row)
          .then(({ error }) => {
            if (error) console.warn('[usage] supabase insert failed:', error.message)
          })
      )
    }
    await Promise.allSettled(tasks)
  } catch {
    // 存储未配置 / 网络失败：静默跳过
  }
}
