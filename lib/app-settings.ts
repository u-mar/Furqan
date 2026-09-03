export type ThemeMode = 'light' | 'sepia' | 'dark'

export const THEME_MODES: ThemeMode[] = ['light', 'sepia', 'dark']

function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'sepia' || value === 'dark'
}

/** How the mushaf page is presented: edge-to-edge, or inside a printed-style frame. */
export type MushafFrameMode = 'edge' | 'framed'

function isFrameMode(value: unknown): value is MushafFrameMode {
  return value === 'edge' || value === 'framed'
}

export interface AppSettings {
  theme: ThemeMode
  /** Mushaf page presentation style. */
  mushafFrame: MushafFrameMode
  offlineDownloaded: boolean
  translationsDownloaded: boolean
  /** Reciter for ayah-by-ayah audio (Read highlighting, Imitate). */
  reciterId: string
  /** Reciter for full-surah playback in Listen — may be surah-only. */
  listenReciterId: string
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
  mushafFrame: 'framed',
  offlineDownloaded: false,
  translationsDownloaded: false,
  reciterId: DEFAULT_RECITER_ID,
  listenReciterId: DEFAULT_RECITER_ID,
  verticalPages: false,
  translationLanguage: DEFAULT_TRANSLATION_LANGUAGE,
}

function parseSettings(parsed: Partial<AppSettings> & { mushafStyle?: string }): AppSettings {
  const reciterId =
    typeof parsed.reciterId === 'string' && parsed.reciterId.length > 0
      ? parsed.reciterId
      : DEFAULT_RECITER_ID
  return {
    theme: isThemeMode(parsed.theme) ? parsed.theme : 'dark',
    mushafFrame: isFrameMode(parsed.mushafFrame) ? parsed.mushafFrame : 'framed',
    offlineDownloaded: Boolean(parsed.offlineDownloaded),
    translationsDownloaded: Boolean(parsed.translationsDownloaded),
    reciterId,
    listenReciterId:
      typeof parsed.listenReciterId === 'string' && parsed.listenReciterId.length > 0
        ? parsed.listenReciterId
        : reciterId,
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
  root.classList.remove('dark', 'sepia')
  if (theme === 'dark') {
    root.classList.add('dark')
    root.style.colorScheme = 'dark'
  } else {
    if (theme === 'sepia') root.classList.add('sepia')
    root.style.colorScheme = 'light'
  }

  // Sepia only re-skins the mushaf, so the app chrome colour stays the light one.
  const themeColor = theme === 'dark' ? '#080b18' : '#f4f2fb'
  let meta = document.querySelector('meta[name="theme-color"]')
  if (!meta) {
    meta = document.createElement('meta')
    meta.setAttribute('name', 'theme-color')
    document.head.appendChild(meta)
  }
  meta.setAttribute('content', themeColor)
}
