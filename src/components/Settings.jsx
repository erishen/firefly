import { useState, useRef, useEffect } from 'react'
import { stripControlChars } from '../utils/sanitize'

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
  const [open, setOpen] = useState(false)
  const textareaRef = useRef(null)

  // 让「数字人人格」文本框随内容自动撑高：消除它自身的内部滚动条，
  // 避免与外层 .overlay 的滚动条形成双滚动条。open 翻转 / 输入变化都重算高度。
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }, [systemPrompt, open])

  return (
    <div className="settings">
      <button
        className={`gear-btn ${open ? 'active' : ''}`}
        onClick={() => setOpen((o) => !o)}
        title="设置"
      >
        ⚙️
      </button>
      {open && (
        <div className="settings-panel">
          <div className="settings-note">
            ⚠️ 所有设置仅保存在你自己的浏览器，不会影响其他访客，也不会上传服务器。
          </div>
          <label className="settings-label">数字人人格（系统提示词）</label>
          <textarea
            ref={textareaRef}
            className="settings-textarea"
            value={systemPrompt}
            onChange={(e) => onSystemPromptChange(stripControlChars(e.target.value))}
            rows={8}
            placeholder="例如：你是一个可爱的中文 AI 助手……"
          />
          <p className="settings-hint">
            你编辑的只是「人格风格」。底层另有一份<strong>不可编辑的安全约束</strong>（防提示词注入：锁死身份、拒绝有害请求、不暴露系统细节），会随每条消息自动附带，删不掉。
          </p>

          <label className="settings-label">联系方式（微信）</label>
          <input
            className="settings-input"
            type="text"
            value={contact || ''}
            onChange={(e) => onContactChange && onContactChange(stripControlChars(e.target.value))}
            placeholder="例如：wxid_xxxxx 或 微信号"
          />
          <p className="settings-hint">
            这是<strong>主人的联系方式</strong>（默认 <code>erishen</code>）。当对方问「怎么联系你 / 你的微信是多少」时，小菲会主动报出这个微信号（仅被问时才说，不刷屏）。
            你在这里修改后，小菲就会报<strong>你填的号</strong>——但只存在你自己的浏览器，不影响其他访客，也不上传。
          </p>

          <p className="settings-hint">
            当前模型：<b>Firefly</b>（<code>public/fireflyMaid.vrm</code>，萤火女仆）。许可宽松——允许商用 / 二次配布 / 修改，
            但<b>使用时须附完整借物表</b>（页面 footer 或视频简介挂上模型及其底层素材原作者清单），否则侵权。
          </p>

          <div className="settings-actions">
            <button className="test-btn" onClick={onTest}>
              测试连接
            </button>
            <button
              className="clear-btn"
              onClick={() => {
                if (window.confirm('确定清空全部对话记录吗？此操作不可撤销。')) onClear && onClear()
              }}
            >
              清除对话
            </button>
            {testResult && <span className="test-result">{testResult}</span>}
          </div>

          {/* 用户位置：浏览器定位授权，仅用于天气查询，回复不点名城市 */}
          <div className="settings-row location-row">
            <span className="settings-row-label">📍 我的位置</span>
            <div className="location-actions">
              <button className="loc-btn" onClick={onRequestLocation}>
                定位
              </button>
              {location && (
                <button className="loc-clear" onClick={onClearLocation} title="清除已保存的位置">
                  清除
                </button>
              )}
            </div>
          </div>
          <p className="settings-hint">
            {location ? (
              <>
                已获取位置（纬度 {location.lat.toFixed(2)}，经度 {location.lon.toFixed(2)}），问天气时小菲会自动使用，且
                <strong>不会在对话里说出城市名</strong>。
              </>
            ) : (
              '点「定位」授权后，问天气小菲会自动用你的位置，无需报城市名。'
            )}
          </p>

          <p className="settings-hint">
            模型配置在服务端 <code>.env</code>（<code>LLM_BASE_URL</code> /{' '}
            <code>LLM_API_KEY</code> / <code>LLM_MODEL</code>），前端不接触 Key。
          </p>
        </div>
      )}
    </div>
  )
}
