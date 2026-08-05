import { useState, useRef, useEffect } from 'react'
import { stripControlChars } from '../utils/sanitize'
import { clearModelCache } from '../utils/modelCache'
import { useI18n } from '../i18n'

// 设置面板：仅前端可配置「数字人人格（系统提示词）」；
// 模型 base/key/model 在服务端 .env，浏览器永远接触不到。
export default function Settings({
  systemPrompt,
  onSystemPromptChange,
  onTest,
  testResult,
  onClear,
  location,
  onRequestLocation,
  onClearLocation,
  contact,
  onContactChange,
}) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const textareaRef = useRef(null)
  const [cacheMsg, setCacheMsg] = useState('')

  // 让「数字人人格」文本框随内容自动撑高：消除它自身的内部滚动条，
  // 避免与外层 .overlay 的滚动条形成双滚动条。open 翻转 / 输入变化都重算高度。
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }, [systemPrompt, open])

  // 清除已缓存的模型字节：当前已加载的 VRM 会缓存在本浏览器，
  // 换模型或想强制重下时调用（确认后删除 Cache API 中的缓存）。
  const handleClearCache = async () => {
    if (!window.confirm(t('confirmClearCache'))) return
    try {
      const ok = await clearModelCache()
      setCacheMsg(ok ? t('cacheCleared') : t('cacheNoSupport'))
    } catch (e) {
      setCacheMsg(t('cacheFail') + (e && e.message ? e.message : String(e)))
    }
  }

  return (
    <div className="settings">
      <button
        className={`gear-btn ${open ? 'active' : ''}`}
        onClick={() => setOpen((o) => !o)}
        title={t('gearTitle')}
      >
        ⚙️
      </button>
      {open && (
        <div className="settings-panel">
          <div className="settings-note">
            ⚠️ {t('settingsNote')}
          </div>
          <label className="settings-label">{t('labelPersona')}</label>
          <textarea
            ref={textareaRef}
            className="settings-textarea"
            value={systemPrompt}
            onChange={(e) => onSystemPromptChange(stripControlChars(e.target.value))}
            rows={8}
            placeholder={t('personaPlaceholder')}
          />
          <p className="settings-hint" dangerouslySetInnerHTML={{ __html: t('personaHint') }} />

          <label className="settings-label">{t('labelContact')}</label>
          <input
            className="settings-input"
            type="text"
            value={contact || ''}
            onChange={(e) => onContactChange && onContactChange(stripControlChars(e.target.value))}
            placeholder={t('contactPlaceholder')}
          />
          <p className="settings-hint" dangerouslySetInnerHTML={{ __html: t('contactHint') }} />

          <div className="settings-row cache-row">
            <div className="settings-row-text">
              <div className="settings-row-label">{t('cacheLabel')}</div>
              <p className="settings-hint">
                {t('cacheHint')}
              </p>
            </div>
            <button className="clear-btn" onClick={handleClearCache}>
              {t('clearCache')}
            </button>
          </div>
          {cacheMsg && <p className="settings-hint cache-msg">{cacheMsg}</p>}

          <div className="settings-actions">
            <button className="test-btn" onClick={onTest}>
              {t('testBtn')}
            </button>
            <button
              className="clear-btn"
              onClick={() => {
                if (window.confirm(t('confirmClearChat'))) onClear && onClear()
              }}
            >
              {t('clearChat')}
            </button>
            {testResult && <span className="test-result">{testResult}</span>}
          </div>

          {/* 用户位置：浏览器定位授权，仅用于天气查询，回复不点名城市 */}
          <div className="settings-row location-row">
            <span className="settings-row-label">{t('locLabel')}</span>
            <div className="location-actions">
              <button className="loc-btn" onClick={onRequestLocation}>
                {t('locBtn')}
              </button>
              {location && (
                <button className="loc-clear" onClick={onClearLocation} title={t('locClear')}>
                  {t('locClear')}
                </button>
              )}
            </div>
          </div>
          <p
            className="settings-hint"
            dangerouslySetInnerHTML={{
              __html: location
                ? t('locHas', { lat: location.lat.toFixed(2), lon: location.lon.toFixed(2) })
                : t('locNone'),
            }}
          />

          <p className="settings-hint" dangerouslySetInnerHTML={{ __html: t('modelConfigHint') }} />
        </div>
      )}
    </div>
  )
}
