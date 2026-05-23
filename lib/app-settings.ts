export type ThemeMode = 'light' | 'dark'

/** Uthmani Hafs = QCF glyph mushaf; IndoPak = Naskh-style text layout (no per-page fonts). */
export type MushafStyle = 'uthmani-glyphs' | 'indopak'

export interface AppSettings {
  theme: ThemeMode
  mushafStyle: MushafStyle
  offlineDownloaded: boolean
}

const STORAGE_KEY = 'al_quran_settings'

const defaults: AppSettings = {
  theme: 'dark',
  mushafStyle: 'uthmani-glyphs',
  offlineDownloaded: false,
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
}
