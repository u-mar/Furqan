export type ThemeMode = 'light' | 'dark'

export interface AppSettings {
  theme: ThemeMode
  offlineDownloaded: boolean
  reciterId: string
  /** Swipe up/down to turn pages instead of left/right. */
  verticalPages: boolean
  /** Translation text language in read mode. */
  translationLanguage: TranslationLanguageId
}

const STORAGE_KEY = 'al_quran_settings'

import { DEFAULT_RECITER_ID } from '@/lib/reciters'
import {
  DEFAULT_TRANSLATION_LANGUAGE,
  type TranslationLanguageId,
  isTranslationLanguageId,
} from '@/lib/translations'

const defaults: AppSettings = {
  theme: 'dark',
  offlineDownloaded: false,
  reciterId: DEFAULT_RECITER_ID,
  verticalPages: false,
  translationLanguage: DEFAULT_TRANSLATION_LANGUAGE,
}

function parseSettings(parsed: Partial<AppSettings> & { mushafStyle?: string }): AppSettings {
  return {
    theme: parsed.theme === 'light' ? 'light' : 'dark',
    offlineDownloaded: Boolean(parsed.offlineDownloaded),
    reciterId:
      typeof parsed.reciterId === 'string' && parsed.reciterId.length > 0
        ? parsed.reciterId
        : DEFAULT_RECITER_ID,
    verticalPages: Boolean(parsed.verticalPages),
    translationLanguage:
      parsed.translationLanguage && isTranslationLanguageId(parsed.translationLanguage)
        ? parsed.translationLanguage
        : DEFAULT_TRANSLATION_LANGUAGE,
  }
}

export function getAppSettings(): AppSettings {
  if (typeof window === 'undefined') return defaults
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaults
    const parsed = JSON.parse(raw) as Partial<AppSettings> & { mushafStyle?: string }
    const next = parseSettings(parsed)
    if ('mushafStyle' in parsed) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    }
    return next
  } catch {
    return defaults
  }
}

export function setAppSettings(patch: Partial<AppSettings>): AppSettings {
  const next = { ...getAppSettings(), ...patch }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('app-settings-changed', { detail: next }))
  }
  return next
}

export function applyThemeToDocument(theme: ThemeMode): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (theme === 'light') {
    root.classList.remove('dark')
    root.style.colorScheme = 'light'
  } else {
    root.classList.add('dark')
    root.style.colorScheme = 'dark'
  }

  const themeColor = theme === 'light' ? '#faf6ef' : '#0a0a0a'
  let meta = document.querySelector('meta[name="theme-color"]')
  if (!meta) {
    meta = document.createElement('meta')
    meta.setAttribute('name', 'theme-color')
    document.head.appendChild(meta)
  }
  meta.setAttribute('content', themeColor)
}
