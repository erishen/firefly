// 模块级 i18n store —— 不依赖 React Context，以供 R3F <Canvas> 内外组件通用
// （R3F v8 的独立 reconciler 不会穿透外层 Context，故用外部 store + useSyncExternalStore）。
import { zh } from './zh'
import { en } from './en'

export const LANGS = [
  { code: 'zh', label: '中文' },
  { code: 'en', label: 'EN' },
]

const DICTS = { zh, en }
const DEFAULT_LANG = 'zh'
const STORAGE_KEY = 'firefly-lang'

// 根据来路(从哪个 erishen.cn 页面进入)推断入口语言：
// - 来自 /home-en/ → 英文
// - 来自 erishen.cn 的其它页面(含中文首页 /)→ 中文
// - 非本站点来路或无法判定 → null(交给后续 localStorage / 默认语言)
// 用途：让 Firefly 的语言跟随"你从哪个 WordPress 页面进来"，而不是被一次英文入口写死的
// localStorage 永久带偏（否则从中文首页点进来也会显示英文）。
export function getReferrerLang() {
  try {
    const r = document.referrer || ''
    if (!r.includes('erishen.cn')) return null
    if (r.includes('/home-en/')) return 'en'
    return 'zh'
  } catch {
    return null
  }
}

// 模块加载时即确定初始语言：URL 参数 ?lang= 优先(便于从外部站点的英文入口直达英文态)，
// 其次「来路」(从哪个 erishen.cn 页面进入)，再次 localStorage(用户手动切换的记忆)，
// 最后回退默认 zh。带 ?lang= 时顺手写入 localStorage，使后续访问保持该语言。
function detectInitialLang() {
  try {
    const p = new URLSearchParams(window.location.search).get('lang')
    if (p && DICTS[p]) {
      try { localStorage.setItem(STORAGE_KEY, p) } catch {}
      return p
    }
  } catch {}
  // 来路优先于 localStorage：从中文首页进就显示中文，从英文落地页进就显示英文，
  // 避免曾被英文入口写入的 localStorage 把"从中文首页进入"也传染成英文。
  const ref = getReferrerLang()
  if (ref) return ref
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v && DICTS[v] ? v : DEFAULT_LANG
  } catch {
    return DEFAULT_LANG
  }
}
let currentLang = detectInitialLang()

const listeners = new Set()

export function getLang() {
  return currentLang
}

export function setLang(lang) {
  if (!DICTS[lang] || lang === currentLang) return
  currentLang = lang
  try {
    localStorage.setItem(STORAGE_KEY, lang)
  } catch {}
  listeners.forEach((fn) => fn(currentLang))
}

// 翻译；支持 {var} 占位替换。缺失 key 回退到默认语言，再缺失回退到 key 本身。
export function t(key, vars) {
  const dict = DICTS[currentLang] || DICTS[DEFAULT_LANG]
  let s = dict ? dict[key] : undefined
  if (s === undefined) s = DICTS[DEFAULT_LANG][key]
  if (s === undefined) return key
  if (vars && typeof s === 'string') {
    for (const [k, v] of Object.entries(vars)) {
      s = s.split(`{${k}}`).join(v)
    }
  }
  return s
}

export function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
