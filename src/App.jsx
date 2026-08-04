import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { useRef, useState, useEffect, useCallback } from 'react'
import Stage from './components/Stage'
import { useVoice } from './hooks/useVoice'
import { useChat, DEFAULT_SYSTEM_PROMPT, DEFAULT_CONTACT } from './hooks/useChat'
import Settings from './components/Settings'
import { stripControlChars } from './utils/sanitize'
import './styles.css'

// 点击角色说的随机台词（无 LLM / 未配置时的兜底演示）
const PHRASES = [
  '你好呀！我是萤火微光里的女仆小菲 ✨',
  '今天有什么可以帮你的呢？',
  '我可以回答问题，也能陪你聊聊天~',
  '试试看，点麦克风跟我说话吧！🎤',
  '欢迎来到我的萤火小屋呀～',
  '我会一直盯着你看哦，知道吗？👀',
  '你看，我身边还飘着一点点萤火微光呢 ✨',
  '是不是比之前可爱了一点点？💚',
  '我的眼睛会跟着鼠标走哦',
  '点我一下，跟我说说话吧！',
  '你好呀！很高兴在萤火里遇见你~',
  '今晚想聊些什么呢？',
  '我还会随机眨眼呢 ✨',
]

const STATUS_TEXT = {
  idle: '',
  listening: '聆听中…说完会自动识别',
  speaking: '朗读中…',
  error: '语音识别失败（国内网络可能受限；可点角色试演示，或在设置里配置 LLM 后用文字）',
  unsupported: '当前浏览器不支持语音识别，请用 Chrome / Edge',
}

export default function App() {
  const speakingRef = useRef(false)
  const [bubble, setBubble] = useState({ text: '', visible: false, who: 'ai' })
  const speakToken = useRef(0) // 防止连点时旧朗读的 onEnd 误关气泡
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT)
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

  // 请求浏览器定位（用户点击「定位」触发，需授权）；结果存本地
  const requestLocation = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setBubble({ text: '⚠️ 当前浏览器不支持定位', visible: true, who: 'ai' })
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
        const msg = err?.code === 1 ? '定位权限被拒绝' : '定位失败'
        setBubble({ text: `⚠️ ${msg}`, visible: true, who: 'ai' })
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 },
    )
  }, [])
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
    setBubble({ text: '思考中…', visible: true, who: 'thinking' })
    await chat.send(text)
  }

  // 文本输入发送（与语音共用 chat.send；先让用户看到自己发的，再进入思考）
  const sendUserMessage = () => {
    const t = text.trim()
    if (!t || chat.streaming) return
    setText('')
    setBubble({ text: t, visible: true, who: 'user' })
    setTimeout(() => {
      setBubble({ text: '思考中…', visible: true, who: 'thinking' })
      chat.send(t)
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
    const text = PHRASES[Math.floor(Math.random() * PHRASES.length)]
    const token = ++speakToken.current
    setBubble({ text, visible: true, who: 'ai' })
    speak(text, () => {
      if (speakToken.current === token) setBubble({ text: '', visible: false })
    })
  }

  // 测试连接：打代理 /api/health 看 .env 是否配置
  const handleTest = async () => {
    try {
      const r = await fetch('/api/health')
      const j = await r.json()
      setTestResult(j.configured ? '✓ 已配置，可以聊天' : '✗ 未配置 .env（参考 .env.example）')
    } catch {
      setTestResult('✗ 代理未启动（请先 npm run dev）')
    }
  }

  const statusText = bubble.who === 'thinking' ? '思考中…' : STATUS_TEXT[status]

  return (
    <>
      <div className="overlay" ref={overlayRef}>
        <h1>✨ Firefly · 3D 数字人</h1>
        <span className="hint">点「🎤 说话」或直接在下方输入文字即可对话 · 拖拽旋转视角 · 她的眼睛会跟着你</span>
        <div className="voicebar">
          <div className="voice-row">
            {supported ? (
              <button
                className={`mic-btn ${status === 'listening' ? 'active' : ''}`}
                onClick={startListening}
              >
                🎤 {status === 'listening' ? '聆听中…' : '说话'}
              </button>
            ) : (
              <span className="voice-warn">{STATUS_TEXT.unsupported}</span>
            )}
            {statusText && <span className="voice-status">{statusText}</span>}
          </div>
          {/* 文本输入：与语音共用 chat.send，国内 STT 被墙时的主要入口。
              默认即就地放大（与对话记录同宽、可纵向拉伸），点 ⤡ 收起、点 ⤢ 再放大。 */}
          <div className={`chatbar ${maximized ? 'expanded' : ''}`}>
            <textarea
              ref={maxRef}
              className="chat-input"
              value={text}
              rows={maximized ? 8 : 1}
              placeholder="输入文字，回车发送…"
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
                发送
              </button>
              <button
                type="button"
                className="chat-expand"
                title={maximized ? '收起输入框' : '展开输入框（在原地放大）'}
                aria-label={maximized ? '收起输入框' : '展开输入框'}
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
            <span>💬 对话记录</span>
            {chat.history.filter((m) => m.role !== 'system').length > 0 && (
              <span className="chat-log-count">
                {chat.history.filter((m) => m.role !== 'system').length} 条
              </span>
            )}
          </div>
          <div className="chat-log" ref={logRef}>
            {chat.history.filter((m) => m.role !== 'system').length === 0 ? (
              <div className="chat-empty">还没有对话记录，点角色或输入文字开始吧～</div>
            ) : (
              chat.history
                .filter((m) => m.role !== 'system')
                .map((m, i) => {
                  const isUser = m.role === 'user'
                  return (
                    <div key={i} className={`msg ${isUser ? 'user' : 'ai'}`}>
                      <span className="msg-avatar">{isUser ? '你' : '菲'}</span>
                      <div className="msg-body">
                        <span className="msg-who">{isUser ? '你' : '小菲'}</span>
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
            <span className="footer-model">✨ 数字人：<b>Firefly Maid</b></span>
            <span className="footer-lic">许可：可商用 / 二次配布 / 修改 · <b>须附完整借物表</b></span>
          </summary>
          <div className="footer-credit">
            <p>模型：<b>Firefly Maid</b> · 作者：<b>Geffol</b>（AplayBox）</p>
            <p>原始发布：<a href="https://www.aplaybox.com/details/model/zeMtLrCcHBSJ" target="_blank" rel="noreferrer">AplayBox · Firefly Maid</a>（2026-05-16）· <a href="https://www.aplaybox.com/u/774182361" target="_blank" rel="noreferrer">作者主页</a></p>
            <p className="footer-lic-line"><b>作者声明许可：</b>允许商用 · 允许二次配布 · 允许修改模型 · 允许视频外用途 · <b>使用须附完整借物表</b></p>
            <p className="footer-note">作者来源页（AplayBox）未提供逐项借物表明细。本页已按作者声明署名并标注许可；若您持有作者原版借物表，可补充粘贴于此以满足「完整借物表」要求。想找原版明细可查 Geffol 的 VRoid Hub / BOOTH / Twitter 主页（AplayBox 仅为国内分发站）。</p>
          </div>
        </details>
      </footer>

    </>
  )
}
