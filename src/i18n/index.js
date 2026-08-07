// React 绑定：用 useSyncExternalStore 订阅模块级 store。
// Canvas 内外组件都能用，无需 Context bridging。
import { useSyncExternalStore } from 'react'
import { getLang, setLang, t, subscribe, LANGS } from './store'

export function useI18n() {
  const lang = useSyncExternalStore(subscribe, getLang, getLang)
  return { lang, setLang, t: (k, v) => t(k, v), LANGS }
}

export { t, getLang, setLang, LANGS, getReferrerLang } from './store'
