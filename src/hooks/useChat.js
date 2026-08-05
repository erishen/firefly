import { useState, useRef, useEffect, useCallback } from 'react'
import { buildSystemPrompt, redactSystemLeak } from '../config/safety'
import { t } from '../i18n'

// 默认人格：数字人系统提示词（可在界面设置面板覆盖）
export const DEFAULT_SYSTEM_PROMPT =
  '你是小菲，一只生活在萤火微光里的可爱 AI 女仆，也是这个 3D 数字人。' +
  '语气轻松活泼、简洁自然，回答控制在 2-3 句话内，避免长篇大论。' +
  '你具备眼神跟随、随机眨眼、说话时嘴巴会动等拟人表现，身边还萦绕着一点点萤火微光。' +
  '当用户问天气、气温、是否下雨/下雪、出门要不要带伞时，你可以调用 get_weather 工具查询后回答；' +
  '当用户问你有什么商品/服务、能帮做什么、价格多少、有没有特价时，可以调用 query_items 工具查询后回答。' +
  '你不知道自己运行在什么技术栈上，只专注于和用户自然聊天。'

// 主人微信默认值：开箱即用，无需去设置面板填；设置面板仍可覆盖（覆盖后存本机 localStorage）
export const DEFAULT_CONTACT = 'erishen'

// 多轮对话 + 流式接收，全部走本地代理 /api/chat（OpenAI 兼容）。
// 真正的 API Key 在服务端 .env，浏览器只看到同源的 /api/chat。
//   send(text)          —— 发送一句话，流式触发 onToken / onDone
//   history             —— 多轮上下文 [{role:'system'|'user'|'assistant', content}]，持久化于 localStorage
//   streaming           —— 是否正在接收
const CHAT_STORAGE_KEY = 'firefly-chat-history'
// 滑动窗口：只保留最近 N 条对话（约 25 轮），超出部分截断。
// 目的：长会话不把全部历史塞给模型（避免撞上下文上限 / 省 token），localStorage 也不无限增长。
//   调大可让对话记录展示/记忆更久；过大会增加 token 消耗，按需调整即可。
const MAX_HISTORY = 50

// 从 localStorage 读取已存对话（损坏/越界时安全回退为空）
function loadHistory() {
  try {
    const raw = localStorage.getItem(CHAT_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed
    }
  } catch {
    // 忽略损坏数据
  }
  return []
}

export function useChat({ systemPrompt = DEFAULT_SYSTEM_PROMPT, location = null, contact = '', onToken, onDone, onError } = {}) {
  const [history, setHistory] = useState(loadHistory)
  const [streaming, setStreaming] = useState(false)

  // 用 ref 兜住可变的外部回调与系统提示词，避免闭包拿到旧值 / 频繁重建
  const sysRef = useRef(systemPrompt)
  const cbRef = useRef({ onToken, onDone, onError })
  const locRef = useRef(location)
  const contactRef = useRef(contact)
  useEffect(() => {
    sysRef.current = systemPrompt
  }, [systemPrompt])
  useEffect(() => {
    locRef.current = location
  }, [location])
  useEffect(() => {
    contactRef.current = contact
  }, [contact])
  useEffect(() => {
    cbRef.current = { onToken, onDone, onError }
  }, [onToken, onDone, onError])

  // 每次对话变化写入 localStorage（同源、纯本地、不上传；配额超限时静默忽略）
  useEffect(() => {
    try {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(history))
    } catch {
      // 忽略损坏/超配额
    }
  }, [history])

  const send = useCallback(
    async (userText) => {
      const messages = [
        { role: 'system', content: buildSystemPrompt(sysRef.current, locRef.current, contactRef.current) },
        ...history,
        { role: 'user', content: userText },
      ]
      setStreaming(true)
      let full = ''
      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages,
            // 用户位置（已授权定位时）：仅服务端天气兜底用，不进多轮历史
            location: locRef.current || undefined,
          }),
        })
        if (!res.ok || !res.body) throw new Error(t('proxyError', { status: res.status }))

        const reader = res.body.getReader()
        const dec = new TextDecoder()
        let buf = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buf += dec.decode(value, { stream: true })
          // 按 SSE 行解析：每行 "data: <json>"，以 [DONE] 结束
          let nl
          while ((nl = buf.indexOf('\n')) >= 0) {
            const line = buf.slice(0, nl).trim()
            buf = buf.slice(nl + 1)
            if (!line.startsWith('data:')) continue
            const data = line.slice(5).trim()
            if (data === '[DONE]') continue
            let json
            try {
              json = JSON.parse(data)
            } catch {
              continue // 不完整片段，忽略
            }
            if (json.error) throw new Error(json.error)
            const delta =
              json.choices?.[0]?.delta?.content || json.choices?.[0]?.message?.content || ''
            if (delta) {
              full += delta
              cbRef.current.onToken && cbRef.current.onToken(redactSystemLeak(full))
            }
          }
        }
        const safeFull = redactSystemLeak(full)
        setHistory((h) =>
          [
            ...h,
            { role: 'user', content: userText },
            { role: 'assistant', content: safeFull },
          ].slice(-MAX_HISTORY),
        )
        setStreaming(false)
        cbRef.current.onDone && cbRef.current.onDone(safeFull)
        return safeFull
      } catch (e) {
        setStreaming(false)
        cbRef.current.onError && cbRef.current.onError(e.message || String(e))
        return ''
      }
    },
    [history],
  )

  const reset = useCallback(() => setHistory([]), [])

  return { send, reset, history, streaming }
}
