export type ThemeMode = 'light' | 'dark'

/** Uthmani Hafs = QCF glyph mushaf; IndoPak = Naskh-style text layout (no per-page fonts). */
export type MushafStyle = 'uthmani-glyphs' | 'indopak'

export interface AppSettings {
  theme: ThemeMode
  mushafStyle: MushafStyle
  offlineDownloaded: boolean
  reciterId: string
  /** Swipe up/down to turn pages instead of left/right. */
  verticalPages: boolean
}

const STORAGE_KEY = 'al_quran_settings'

import { DEFAULT_RECITER_ID } from '@/lib/reciters'

const defaults: AppSettings = {
  theme: 'dark',
  mushafStyle: 'uthmani-glyphs',
  offlineDownloaded: false,
  reciterId: DEFAULT_RECITER_ID,
  verticalPages: false,
}

export function getAppSettings(): AppSettings {
  if (typeof window === 'undefined') return defaults
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaults
    const parsed = JSON.parse(raw) as Partial<AppSettings>
    return {
      theme: parsed.theme === 'light' ? 'light' : 'dark',
      mushafStyle: parsed.mushafStyle === 'indopak' ? 'indopak' : 'uthmani-glyphs',
      offlineDownloaded: Boolean(parsed.offlineDownloaded),
      reciterId:
        typeof parsed.reciterId === 'string' && parsed.reciterId.length > 0
          ? parsed.reciterId
          : DEFAULT_RECITER_ID,
      verticalPages: Boolean(parsed.verticalPages),
    }
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

  const themeColor = theme === 'light' ? '#f5f5f4' : '#0a0a0a'
  let meta = document.querySelector('meta[name="theme-color"]')
  if (!meta) {
    meta = document.createElement('meta')
    meta.setAttribute('name', 'theme-color')
    document.head.appendChild(meta)
  }
  meta.setAttribute('content', themeColor)
}
