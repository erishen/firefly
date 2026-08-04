// XSS 防护工具集
//
// 本应用当前所有「用户输入 / AI 回复」都通过 React 的 JSX 文本插值（{text}）渲染，
// React 默认会对 < > & " ' 做 HTML 转义，因此天然免疫 XSS——不需要任何额外处理。
//
// 唯一会重新引入 XSS 的情况：有人为了给 AI 回复做富文本 / Markdown 美化，
// 改用 dangerouslySetInnerHTML 直接塞 HTML。本文件就是为此准备的「白名单消毒」入口，
// 约定：任何要走 innerHTML 的字符串，必须先过 sanitizeHtml()，禁止裸塞。
//
// 设计原则：
//   - escapeHtml() 是不可绕过的硬转义（用于手动拼 DOM 文本节点时的兜底）。
//   - sanitizeHtml() 是 best-effort 的标签级清洗（剥离 script/style/iframe、
//     事件属性、javascript:/data: 协议）。对不可信 HTML 的工业级方案请装 DOMPurify；
//     本文件覆盖「万一哪天要渲染富文本」的最小可用守门，而不是替代 DOMPurify。

const HTML_ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

/**
 * 将字符串转义为安全的 HTML 文本（不可绕过，推荐用于手动拼 DOM）。
 * @param {string} input
 * @returns {string}
 */
export function escapeHtml(input) {
  if (input == null) return ''
  return String(input).replace(/[&<>"']/g, (ch) => HTML_ESCAPE_MAP[ch])
}

/**
 * 清洗可能含 HTML 的字符串，去掉会执行代码的标签 / 属性 / 协议。
 * 仅用于「确实要渲染富文本」的场景（搭配 dangerouslySetInnerHTML）。
 * 普通文本渲染请继续用 React 的 {text}，无需本函数。
 * @param {string} dirty
 * @returns {string}
 */
export function sanitizeHtml(dirty) {
  if (dirty == null) return ''
  let s = String(dirty)
  // 1) 整段移除会执行的块级标签
  s = s.replace(/<\s*(script|style|iframe|object|embed|link|meta)[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
  s = s.replace(/<\s*(script|style|iframe|object|embed|link|meta)\b[^>]*\/?>/gi, '')
  // 2) 移除所有 on* 事件处理属性（onclick / onerror / onload ...）
  s = s.replace(/\s+on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
  // 3) 移除 javascript: / data: 协议（仅保留 http/https/相对路径/锚点）
  s = s.replace(/(href|src)\s*=\s*("javascript:[^"]*"|'javascript:[^']*')/gi, '$1="#"')
  s = s.replace(/(href|src)\s*=\s*("data:[^"]*"|'data:[^']*')/gi, '$1="#"')
  return s
}

/**
 * 输入边界的通用消毒：去掉不可见的控制字符 / 空字节，
 * 不影响正常语义（控制字符在提示词 / 聊天里无意义，却可能用于绕过或注入）。
 * @param {string} input
 * @returns {string}
 */
export function stripControlChars(input) {
  if (input == null) return ''
  // 保留 \n \r \t 等常见空白；移除其它 C0/C1 控制字符
  return String(input).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
}
