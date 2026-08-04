import { useRef, useState, useEffect, useCallback } from 'react'

// 朗读前清洗：去掉 emoji / 装饰符号，只留文字与标点。
// 显示气泡仍用原文（含 emoji），仅 TTS 朗读时跳过这些符号。
function stripSpeechSymbols(t) {
  if (!t) return ''
  return t
    .replace(/\p{Extended_Pictographic}/gu, '') // emoji 主码点
    .replace(/[\u{1F3FB}-\u{1F3FF}\uFE0F\u200D\u20E3]/gu, '') // 肤色修饰符 / 变体选择符 / ZWJ / 键帽
    .replace(/[\u{2190}-\u{21FF}\u{2300}-\u{23FF}\u{24C2}\u{2139}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{1F000}-\u{1FAFF}\u{1F1E6}-\u{1F1FF}]/gu, '') // 箭头 / 技术符号 / 杂项符号 / 各类 emoji
    .replace(/\s+/g, ' ')
    .trim()
}

// 浏览器原生语音：识别(STT) + 合成(TTS)，零依赖、零 key。
// - STT: window.SpeechRecognition || window.webkitSpeechRecognition（Chrome/Edge 支持）
// - TTS: window.speechSynthesis（本机系统嗓音，离线可用，国内无碍）
//
// 状态机：idle → listening → speaking → idle；识别失败 → error（国内网络拉不到 Google 识别服务时常见）。
export function useVoice({ speakingRef, onTranscript, onFinal, lang = 'zh-CN' }) {
  const [status, setStatus] = useState('idle') // idle | listening | speaking | error | unsupported
  const [supported, setSupported] = useState(true)
  const recognitionRef = useRef(null)
  const finalText = useRef('')
  const mounted = useRef(true)
  // 用 ref 兜住回调，避免把它们塞进 effect 依赖导致识别器反复重建
  const onTranscriptRef = useRef(onTranscript)
  useEffect(() => {
    onTranscriptRef.current = onTranscript
  }, [onTranscript])
  const onFinalRef = useRef(onFinal)
  useEffect(() => {
    onFinalRef.current = onFinal
  }, [onFinal])

  useEffect(() => {
    mounted.current = true
    const SR =
      typeof window !== 'undefined' &&
      (window.SpeechRecognition || window.webkitSpeechRecognition)
    if (!SR) {
      setSupported(false)
      setStatus('unsupported')
      return
    }
    const rec = new SR()
    rec.lang = lang
    rec.interimResults = true
    rec.continuous = false
    rec.maxAlternatives = 1

    rec.onresult = (e) => {
      let interim = ''
      let final = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]
        if (res.isFinal) final += res[0].transcript
        else interim += res[0].transcript
      }
      if (final) finalText.current = final
      // 实时把「已确定 + 临时」文本透出，气泡里能看到逐字出来
      const shown = (finalText.current + interim).trim()
      if (shown) onTranscriptRef.current && onTranscriptRef.current(shown)
    }
    rec.onerror = (e) => {
      if (!mounted.current) return
      // no-speech / aborted 不算致命，network/服务不可达才提示
      if (e.error !== 'no-speech' && e.error !== 'aborted') {
        console.warn('[useVoice] STT error:', e.error)
        setStatus('error')
      }
    }
    rec.onend = () => {
      if (!mounted.current) return
      const text = finalText.current.trim()
      finalText.current = ''
      if (text) {
        // 识别完成 → 透出最终文本 + 触发「识别完成」回调（由 App 接 LLM 生成回复）
        onTranscriptRef.current && onTranscriptRef.current(text)
        onFinalRef.current && onFinalRef.current(text)
      } else {
        setStatus('idle')
      }
    }
    recognitionRef.current = rec

    return () => {
      mounted.current = false
      try {
        rec.stop()
      } catch {
        /* noop */
      }
    }
    // speak 在下方定义，这里仅需 lang
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang])

    const speak = useCallback(
      (text, onEnd) => {
        if (typeof window === 'undefined' || !window.speechSynthesis) {
          onEnd && onEnd()
          return
        }
        // 朗读前清洗：去掉 emoji/符号，只念文字（显示气泡仍用原文，不受影响）
        const speechText = stripSpeechSymbols(text)
        if (!speechText) {
          onEnd && onEnd()
          return
        }
        window.speechSynthesis.cancel()
        const u = new SpeechSynthesisUtterance(speechText)
      u.lang = lang
      u.rate = 1.0
      u.pitch = 1.2 // 略高，偏可爱/少女感，贴合「女仆小菲」人设
      // 选嗓音：优先「中文女声」，其次任意中文，再回退系统默认
      const voices = window.speechSynthesis.getVoices()
      const pickVoice = () => {
        if (!voices.length) return null
        // 先找明确女声的中文嗓音（跨平台名字差异大，模糊匹配）
        const femaleZh = voices.find(
          (v) =>
            /cmn|zh/i.test(v.lang) &&
            /female|女|婷婷|ting-?ting|美佳|mei-?jia|瑶瑶|yaoyao|晓晓|xiaoxiao|慧慧|huihui|小艺|xiaoyi|kouxin/i.test(
              v.name + ' ' + v.lang,
            ),
        )
        if (femaleZh) return femaleZh
        const zh =
          voices.find((v) => /^zh|cmn/i.test(v.lang)) ||
          voices.find((v) => /chinese|中文|普通话|ting-ting|mei-?jia/i.test(v.name))
        return zh || null
      }
      const v = pickVoice()
      if (v) u.voice = v
      u.onstart = () => {
        if (!mounted.current) return
        speakingRef.current = true
        setStatus('speaking')
      }
      u.onend = () => {
        if (!mounted.current) return
        speakingRef.current = false
        setStatus('idle')
        onEnd && onEnd()
      }
      u.onerror = () => {
        if (!mounted.current) return
        speakingRef.current = false
        setStatus('error')
        onEnd && onEnd()
      }
      window.speechSynthesis.speak(u)
    },
    [lang, speakingRef],
  )

  const startListening = useCallback(() => {
    const rec = recognitionRef.current
    if (!rec) return
    try {
      finalText.current = ''
      setStatus('listening')
      rec.start()
    } catch {
      // 已在监听时重复 start 会抛错，忽略即可
    }
  }, [])

  const stopListening = useCallback(() => {
    try {
      recognitionRef.current && recognitionRef.current.stop()
    } catch {
      /* noop */
    }
  }, [])

  return { startListening, stopListening, speak, status, supported }
}
