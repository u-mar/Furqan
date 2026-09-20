'use client'

import { useCallback, useSyncExternalStore } from 'react'
import { currentLanguage, translate, type AppLanguage, type TVars } from '@/lib/i18n-core'

export * from '@/lib/i18n-core'

function subscribe(onChange: () => void) {
  window.addEventListener('app-settings-changed', onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener('app-settings-changed', onChange)
    window.removeEventListener('storage', onChange)
  }
}

/** The chosen language. English on the server, then the saved one once mounted. */
export function useLanguage(): AppLanguage {
  return useSyncExternalStore(subscribe, currentLanguage, () => 'en')
}

/** `t('Settings')` in the chosen language. */
export function useT() {
  const language = useLanguage()
  return useCallback((text: string, vars?: TVars) => translate(language, text, vars), [language])
}
