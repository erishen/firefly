import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { useRef, useState, useEffect, useCallback } from 'react'
import Stage from './components/Stage'
import { useVoice } from './hooks/useVoice'
import { useChat, DEFAULT_CONTACT } from './hooks/useChat'
import Settings from './components/Settings'
import { stripControlChars } from './utils/sanitize'
import { useI18n } from './i18n'
import './styles.css'

// 点击角色说的随机台词（无 LLM / 未配置时的兜底演示）——按当前语言取
export default function App() {
  const { lang, setLang, t, LANGS } = useI18n()
  const speakingRef = useRef(false)
  const [bubble, setBubble] = useState({ text: '', visible: false, who: 'ai' })
  const speakToken = useRef(0) // 防止连点时旧朗读的 onEnd 误关气泡
  const [systemPrompt, setSystemPrompt] = useState(() => t('defaultPersona'))

  // 同步 <html lang> 属性，便于 SEO / 无障碍（随界面语言变化）
  useEffect(() => {
    document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN'
  }, [lang])
  const [testResult, setTestResult] = useState('')
  const [modelSource, setModelSource] = useState('firefly') // 'avaturn' / 'rpm'(avatar.glb) / 'model'(model.glb) / 'vrm'(avatar.vrm, VRoid) / 'test'(test.vrm) / 'firefly'(fireflyMaid.vrm)

  // 用户位置：浏览器定位（需授权），存本地，仅供天气查询、回复不点名城市
  const [location, setLocation] = useState(() => {
    try {
      const raw = localStorage.getItem('firefly-user-location')
      if (raw) {
        const p = JSON.parse(raw)
        if (typeof p?.lat === 'number' && typeof p?.lon === 'number') return p
      }
    } catch {}
    return null
  })

  // 主人联系方式（微信等）：设置面板可配置，存本地，注入系统提示词
  // 未配置时回退到默认值 DEFAULT_CONTACT（开箱即用，无需手动填）
  const [contact, setContact] = useState(() => {
    try {
      return localStorage.getItem('firefly-user-contact') || DEFAULT_CONTACT
    } catch {
      return DEFAULT_CONTACT
    }
  })
  const handleContactChange = useCallback(
    (v) => {
      setContact(v)
      try {
        if (v && v.trim()) localStorage.setItem('firefly-user-contact', v)
        else localStorage.removeItem('firefly-user-contact')
      } catch {}
    },
    [],
  )

  // 多轮对话（走本地代理，真正的 key 在服务端 .env）
  const chat = useChat({
    systemPrompt,
    location,
    contact,
    onToken: (partial) => setBubble({ text: partial, visible: true, who: 'ai' }),
    onDone: (full) => {
      if (full) speak(full, () => setBubble({ text: '', visible: false }))
    },
    onError: (msg) => setBubble({ text: '⚠️ ' + msg, visible: true, who: 'ai' }),
  })

  // 语言切换：切换界面语言 + 重置人格为对应语言默认（systemPrompt 未持久化，刷新即默认，无副作用）
  const handleLangChange = (code) => {
    setLang(code)
    setSystemPrompt(t('defaultPersona'))
  }

  // 请求浏览器定位（用户点击「定位」触发，需授权）；结果存本地
  const requestLocation = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setBubble({ text: '⚠️ ' + t('locUnsupported'), visible: true, who: 'ai' })
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lon: pos.coords.longitude, ts: Date.now() }
        setLocation(next)
        try {
          localStorage.setItem('firefly-user-location', JSON.stringify(next))
        } catch {}
      },
      (err) => {
        const msg = err?.code === 1 ? t('locDenied') : t('locFailed')
        setBubble({ text: `⚠️ ${msg}`, visible: true, who: 'ai' })
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 },
    )
  }, [t])
  const clearLocation = useCallback(() => {
    setLocation(null)
    try {
      localStorage.removeItem('firefly-user-location')
    } catch {}
  }, [])

  const [text, setText] = useState('')
  // 输入框默认就地放大（与对话记录同宽、可纵向拉伸），点 ⤡ 可收起
  const [maximized, setMaximized] = useState(true)
  const maxRef = useRef(null)

  // 对话记录面板：自动滚到底部（新消息可见）
  const logRef = useRef(null)
  const overlayRef = useRef(null)
  useEffect(() => {
    const el = logRef.current
    // 矮屏下 chat-log 不再独立滚动（overflow:visible），此时滚动容器是外层 .overlay
    if (el && el.scrollHeight > el.clientHeight + 1) {
      el.scrollTop = el.scrollHeight
    } else {
      const ov = overlayRef.current
      if (ov) ov.scrollTop = ov.scrollHeight
    }
  }, [chat.history])

  // 输入框放大（默认即放大）：用户点击 ⤡/⤢ 切换时聚焦文本框并把光标移到末尾；
  // 跳过首次挂载，避免页面加载时抢走焦点
  const inputMountedRef = useRef(false)
  useEffect(() => {
    if (!inputMountedRef.current) {
      inputMountedRef.current = true
      return
    }
    if (maximized && maxRef.current) {
      const el = maxRef.current
      el.focus()
      const len = el.value.length
      el.setSelectionRange(len, len)
    }
  }, [maximized])

  // 语音识别完成 → 交给 LLM 生成回复
  const handleUserText = async (text) => {
    setBubble({ text: t('thinking'), visible: true, who: 'thinking' })
    await chat.send(text)
  }

  // 文本输入发送（与语音共用 chat.send；先让用户看到自己发的，再进入思考）
  const sendUserMessage = () => {
    const txt = text.trim()
    if (!txt || chat.streaming) return
    setText('')
    setBubble({ text: txt, visible: true, who: 'user' })
    setTimeout(() => {
      setBubble({ text: t('thinking'), visible: true, who: 'thinking' })
      chat.send(txt)
    }, 500)
  }

  // 语音：实时显示用户说的话；识别完成触发 LLM
  const { startListening, speak, status, supported } = useVoice({
    speakingRef,
    onTranscript: (shown) => setBubble({ text: shown, visible: true, who: 'user' }),
    onFinal: handleUserText,
  })

  // 点击角色（无语音/未配置 LLM 时的兜底）：随机台词 + 朗读出声
  const handleClick = () => {
    const phrases = t('phrases')
    const line = phrases[Math.floor(Math.random() * phrases.length)]
    const token = ++speakToken.current
    setBubble({ text: line, visible: true, who: 'ai' })
    speak(line, () => {
      if (speakToken.current === token) setBubble({ text: '', visible: false })
    })
  }

  // 测试连接：打代理 /api/health 看 .env 是否配置
  const handleTest = async () => {
    try {
      const r = await fetch('/api/health')
      const j = await r.json()
      setTestResult(j.configured ? t('testOk') : t('testNoEnv'))
    } catch {
      setTestResult(t('testNoProxy'))
    }
  }

  const statusText =
    bubble.who === 'thinking'
      ? t('thinking')
      : status === 'listening'
        ? t('statusListening')
        : status === 'speaking'
          ? t('statusSpeaking')
          : status === 'error'
            ? t('statusError')
            : status === 'unsupported'
              ? t('statusUnsupported')
              : ''

  return (
    <>
      <div className="overlay" ref={overlayRef}>
        <div className="topbar">
          <h1>{t('title')}</h1>
          <div className="topbar-actions">
            <div className="lang-switch" role="group" aria-label={t('langLabel')}>
              {LANGS.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  className={`lang-btn ${lang === l.code ? 'active' : ''}`}
                  onClick={() => handleLangChange(l.code)}
                >
                  {l.label}
                </button>
              ))}
            </div>
            {/* 返回主页：跟随「当前界面语言」(lang) 回到对应的中/英文首页。
                入口语言已由 detectInitialLang 按 ?lang= 参数 → 来路 → localStorage 正确判定，
                故此处直接用当前界面语言即可，既不偏中文也不会被 stale 记忆带偏。 */}
            <a
              className="back-home"
              href={lang === 'en' ? 'https://erishen.cn/home-en/' : 'https://erishen.cn/'}
              title="erishen.cn"
            >
              ← {t('backHome')}
            </a>
          </div>
        </div>
        <span className="hint">{t('hint')}</span>
        <div className="voicebar">
          <div className="voice-row">
            {supported ? (
              <button
                className={`mic-btn ${status === 'listening' ? 'active' : ''}`}
                onClick={startListening}
              >
                {status === 'listening' ? t('micListening') : t('micSpeak')}
              </button>
            ) : (
              <span className="voice-warn">{t('statusUnsupported')}</span>
            )}
            {statusText && <span className="voice-status">{statusText}</span>}
          </div>
          {supported && <p className="voice-note">{t('micNote')}</p>}
          {/* 文本输入：与语音共用 chat.send，国内 STT 被墙时的主要入口。
              默认即就地放大（与对话记录同宽、可纵向拉伸），点 ⤡ 收起、点 ⤢ 再放大。 */}
          <div className={`chatbar ${maximized ? 'expanded' : ''}`}>
            <textarea
              ref={maxRef}
              className="chat-input"
              value={text}
              rows={maximized ? 8 : 1}
              placeholder={t('inputPlaceholder')}
              disabled={chat.streaming}
              onChange={(e) => setText(stripControlChars(e.target.value))}
              onKeyDown={(e) => {
                if (e.key === 'Escape' && maximized) {
                  e.preventDefault()
                  setMaximized(false)
                  return
                }
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  sendUserMessage()
                }
              }}
            />
            <div className="chatbar-actions">
              <button
                className="chat-send"
                disabled={chat.streaming}
                onClick={sendUserMessage}
              >
                {t('send')}
              </button>
              <button
                type="button"
                className="chat-expand"
                title={maximized ? t('expandCollapse') : t('expandExpand')}
                aria-label={maximized ? t('expandCollapse') : t('expandExpand')}
                disabled={chat.streaming}
                onClick={() => setMaximized((v) => !v)}
              >
                {maximized ? '⤡' : '⤢'}
              </button>
            </div>
          </div>
        </div>
        {/* 对话记录：渲染 chat.history（已持久化于 localStorage，刷新不丢）。
            system 角色不展示，只显示 你 / 小菲 的来回。 */}
        <div className="chat-panel">
          <div className="chat-log-head">
            <span>{t('chatLogTitle')}</span>
            {chat.history.filter((m) => m.role !== 'system').length > 0 && (
              <span className="chat-log-count">
                {t('chatLogCount', { n: chat.history.filter((m) => m.role !== 'system').length })}
              </span>
            )}
          </div>
          <div className="chat-log" ref={logRef}>
            {chat.history.filter((m) => m.role !== 'system').length === 0 ? (
              <div className="chat-empty">{t('chatEmpty')}</div>
            ) : (
              chat.history
                .filter((m) => m.role !== 'system')
                .map((m, i) => {
                  const isUser = m.role === 'user'
                  return (
                    <div key={i} className={`msg ${isUser ? 'user' : 'ai'}`}>
                      <span className="msg-avatar">{isUser ? t('youLabel') : t('feiLabel')}</span>
                      <div className="msg-body">
                        <span className="msg-who">{isUser ? t('youName') : t('feiName')}</span>
                        <span className="msg-text">{m.content}</span>
                      </div>
                    </div>
                  )
                })
            )}
          </div>
        </div>
        <Settings
          systemPrompt={systemPrompt}
          onSystemPromptChange={setSystemPrompt}
          onTest={handleTest}
          testResult={testResult}
          onClear={chat.reset}
          location={location}
          onRequestLocation={requestLocation}
          onClearLocation={clearLocation}
          contact={contact}
          onContactChange={handleContactChange}
        />
      </div>
        <Canvas shadows camera={{ position: [0, 1.3, 3.4], fov: 40 }}>
          <Stage
            speakingRef={speakingRef}
            bubble={bubble}
            onClick={handleClick}
            modelSource={modelSource}
          />
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.05}
          autoRotate
          autoRotateSpeed={0.6}
          target={[0, 1, 0]}
          minPolarAngle={Math.PI / 3}
          maxPolarAngle={Math.PI / 2.2}
        />
      </Canvas>

      {/* Firefly Maid 许可要求「使用时须书写完整借物表」。
          作者来源页(AplayBox)未提供逐项素材明细，此处按作者声明做署名 + 许可标注；
          若日后取得作者原版借物表可在此补充。 */}
      <footer className="site-footer">
        <details>
          <summary>
            <span className="footer-model">{t('footerModel')}<b>Firefly Maid</b></span>
            <span className="footer-lic">{t('footerLic')}</span>
          </summary>
          <div className="footer-credit">
            <p>{t('footerCreditModel')}<b>Firefly Maid</b> · {t('footerCreditAuthor')}<b>Geffol</b>（AplayBox）</p>
            <p>{t('footerCreditSource')}<a href="https://www.aplaybox.com/details/model/zeMtLrCcHBSJ" target="_blank" rel="noreferrer">AplayBox · Firefly Maid</a>（2026-05-16）· <a href="https://www.aplaybox.com/u/774182361" target="_blank" rel="noreferrer">{t('footerCreditAuthor')}{t('home')}</a></p>
            <p className="footer-lic-line"><b>{t('footerLicLine')}</b>{t('footerLic')}</p>
            <p className="footer-note">{t('footerNote')}</p>
          </div>
        </details>
      </footer>

    </>
  )
}
