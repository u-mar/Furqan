import { getAppSettings } from '@/lib/app-settings'
import { DICT } from '@/lib/i18n-dict'

/** The language of the app's own menus and buttons (not the Quran translation). */
export type AppLanguage = 'en' | 'so' | 'ar'

/** Each language is named in itself, so anyone can find theirs. */
export const APP_LANGUAGES: { id: AppLanguage; name: string; hint: string }[] = [
  { id: 'en', name: 'English', hint: 'English' },
  { id: 'so', name: 'Soomaali', hint: 'Somali' },
  { id: 'ar', name: 'العربية', hint: 'Arabic' },
]

export function isAppLanguage(value: unknown): value is AppLanguage {
  return value === 'en' || value === 'so' || value === 'ar'
}

export function isRtl(language: AppLanguage): boolean {
  return language === 'ar'
}

export type TVars = Record<string, string | number>

/**
 * `text` is the English line; the other languages come from lib/i18n-dict.ts.
 * `{name}` in the text is replaced from `vars` after translating.
 */
export function translate(language: AppLanguage, text: string, vars?: TVars): string {
  const found = language === 'en' ? undefined : DICT[text]?.[language]
  const out = found ?? text
  if (!vars) return out
  return out.replace(/\{(\w+)\}/g, (whole, name: string) => (name in vars ? String(vars[name]) : whole))
}

export function currentLanguage(): AppLanguage {
  if (typeof window === 'undefined') return 'en'
  const stored = getAppSettings().language
  return isAppLanguage(stored) ? stored : 'en'
}

/** For code that runs outside a component (toasts, errors); components use useT. */
export function tr(text: string, vars?: TVars): string {
  return translate(currentLanguage(), text, vars)
}

/** Keeps <html lang> and <html dir> in step with the choice. */
export function applyLanguageToDocument(language: AppLanguage): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.lang = language
  root.dir = isRtl(language) ? 'rtl' : 'ltr'
}
