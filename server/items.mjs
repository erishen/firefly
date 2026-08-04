// 商品/服务查询工具（调用已部署在 api.erishen.cn 的 fastapi-web 公开只读接口）
//
// fastapi-web 是主人的商品/服务管理系统。其 /items 系列接口公开、无需认证、
// 返回数据无 PII（仅商品名 / 价格 / 是否特价 / 描述），正适合交给数字人对外的查询能力。
//
// 调用全程在服务端完成，浏览器只看到同源的 /api/chat（或直接 /api/items 调试），
// 既不暴露 api.erishen.cn 的 CORS 限制，也不把密钥/网络拓扑泄漏到前端。
//
// 健壮性：兼容多种返回结构（裸数组 / {items} / {data} / {results} / {list}），
// 任何异常都把 HTTP 状态码和原始响应片段带回，便于排障。
import { proxyAgent } from './config.mjs'
import { fetchWithTimeout } from './httpUtils.mjs'

// 已部署地址（如需指向其他实例或子路径，可用 ITEMS_API_BASE 环境变量覆盖）
const ITEMS_BASE = (process.env.ITEMS_API_BASE || 'https://api.erishen.cn').replace(/\/$/, '')

// 从多种可能的响应结构中取出商品数组
function extractItems(parsed) {
  if (Array.isArray(parsed)) return parsed
  if (parsed && Array.isArray(parsed.items)) return parsed.items
  if (parsed && Array.isArray(parsed.data)) return parsed.data
  if (parsed && Array.isArray(parsed.results)) return parsed.results
  if (parsed && Array.isArray(parsed.list)) return parsed.list
  return null
}

// 查询商品/服务清单。
//   args.keyword   可选，按名称筛选（走 /items/search）
//   args.limit     返回上限，默认 20，最大 50
// 返回 { ok, count?, summary?, status?, raw?, error? }
export async function fetchItems(args = {}, dispatcher = proxyAgent) {
  const keyword = (args.keyword || '').toString().trim()
  let limit = Number(args.limit)
  if (!Number.isFinite(limit) || limit <= 0) limit = 20
  limit = Math.min(limit, 50)

  const url = keyword
    ? `${ITEMS_BASE}/items/search?keyword=${encodeURIComponent(keyword)}&limit=${limit}`
    : `${ITEMS_BASE}/items/?limit=${limit}`

  try {
    console.log(`[items] 请求 ${url}`)
    const res = await fetchWithTimeout(url, { dispatcher: dispatcher || undefined }, 8000)
    const text = await res.text()
    console.log(`[items] 响应 HTTP ${res.status}，body 前 240 字符：${text.slice(0, 240)}`)

    if (!res.ok) {
      return {
        ok: false,
        error: `商品服务返回 HTTP ${res.status}`,
        status: res.status,
        raw: text.slice(0, 500),
      }
    }

    let parsed = null
    try {
      parsed = JSON.parse(text)
    } catch {
      return {
        ok: false,
        error: '商品服务返回的不是合法 JSON',
        status: res.status,
        raw: text.slice(0, 500),
      }
    }

    const items = extractItems(parsed)
    if (!items) {
      return {
        ok: false,
        error: '商品服务返回的数据不是商品列表（也不在 items/data/results/list 字段里）',
        status: res.status,
        raw: text.slice(0, 500),
      }
    }
    if (items.length === 0) {
      return { ok: true, count: 0, summary: '（接口返回空列表：数据库里可能还没有商品）' }
    }

    const lines = items.map((it, i) => {
      const name = it.name || '未命名'
      const price = typeof it.price === 'number' ? `¥${it.price}` : ''
      const offer = it.is_offer ? '（特价）' : ''
      const desc = it.description ? `：${it.description}` : ''
      return `${i + 1}. ${name} ${price}${offer}${desc}`
    })
    return { ok: true, count: items.length, summary: lines.join('\n'), raw: items }
  } catch (e) {
    const isTimeout = e?.name === 'AbortError'
    return {
      ok: false,
      error: isTimeout ? '商品服务请求超时（上游未响应）' : `商品服务调用失败：${e?.message || String(e)}`,
      cause: e?.cause?.code || (e?.cause && e.cause.message) || '',
    }
  }
}

// 暴露给 LLM 的商品查询工具定义（OpenAI 兼容 function calling 格式）
export const ITEMS_TOOL = {
  type: 'function',
  function: {
    name: 'query_items',
    description:
      '查询主人提供的商品/服务清单（名称、价格、是否特价、简介）。当用户问「有什么服务」「能提供什么」「有哪些商品」「价格多少」「有没有特价/优惠」等时使用。可传关键词做筛选。',
    parameters: {
      type: 'object',
      properties: {
        keyword: {
          type: 'string',
          description:
            '可选，按商品/服务名称筛选的关键词，例如：咨询、开发、设计。留空则返回全部。',
        },
        limit: {
          type: 'number',
          description: '返回数量上限，默认 20，最大 50。',
        },
      },
    },
  },
}
