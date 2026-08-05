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

// 模块加载时即确定初始语言（localStorage 同步可读）
let currentLang = (() => {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v && DICTS[v] ? v : DEFAULT_LANG
  } catch {
    return DEFAULT_LANG
  }
})()

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
