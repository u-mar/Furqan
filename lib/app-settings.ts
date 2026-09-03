export type ThemeMode = 'light' | 'dark' | 'black'

export const THEME_MODES: ThemeMode[] = ['light', 'dark', 'black']

function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'black'
}

/**
 * How wide the mushaf page runs.
 * - `full`   — text runs to the edges, so the script renders larger (Ayah-style)
 * - `spaced` — generous side margins, so the script renders smaller
 */
export type MushafWidthMode = 'full' | 'spaced'

function isWidthMode(value: unknown): value is MushafWidthMode {
  return value === 'full' || value === 'spaced'
}

export interface AppSettings {
  theme: ThemeMode
  /** Mushaf page width. */
  mushafWidth: MushafWidthMode
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
  mushafWidth: 'full',
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
    mushafWidth: isWidthMode(parsed.mushafWidth) ? parsed.mushafWidth : 'full',
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
  root.classList.remove('dark', 'black')
  if (theme === 'dark' || theme === 'black') {
    // Black builds on the dark palette, then overrides it to pure black.
    root.classList.add('dark')
    if (theme === 'black') root.classList.add('black')
    root.style.colorScheme = 'dark'
  } else {
    root.style.colorScheme = 'light'
  }

  const themeColor =
    theme === 'black' ? '#000000' : theme === 'dark' ? '#080b18' : '#f4f2fb'
  let meta = document.querySelector('meta[name="theme-color"]')
  if (!meta) {
    meta = document.createElement('meta')
    meta.setAttribute('name', 'theme-color')
    document.head.appendChild(meta)
  }
  meta.setAttribute('content', themeColor)
}
