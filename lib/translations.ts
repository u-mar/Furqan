/** Translation languages and their available editions (AlQuran Cloud identifiers). */

export type TranslationLanguageId = 'en' | 'so'

export interface TranslationOption {
  /** AlQuran Cloud edition identifier, e.g. "en.sahih". Doubles as a unique id. */
  id: string
  languageId: TranslationLanguageId
  /** Translator/edition display name. */
  label: string
}

/** Every translation edition the app can show, grouped implicitly by languageId. */
export const TRANSLATION_OPTIONS: TranslationOption[] = [
  { id: 'en.sahih', languageId: 'en', label: 'Saheeh International' },
  { id: 'en.yusufali', languageId: 'en', label: 'Abdullah Yusuf Ali' },
  { id: 'en.pickthall', languageId: 'en', label: 'Marmaduke Pickthall' },
  { id: 'so.abduh', languageId: 'so', label: 'Mahmud Muhammad Abduh' },
]

export const DEFAULT_TRANSLATION_LANGUAGE: TranslationLanguageId = 'en'

/** The edition each language falls back to — also the only one available offline. */
export const DEFAULT_TRANSLATION_EDITION: Record<TranslationLanguageId, string> = {
  en: 'en.sahih',
  so: 'so.abduh',
}

const LANGUAGE_LABELS: Record<TranslationLanguageId, string> = {
  en: 'English',
  so: 'Somali',
}

export function translationLanguageLabel(lang: TranslationLanguageId): string {
  return LANGUAGE_LABELS[lang]
}

export function translationsForLanguage(lang: TranslationLanguageId): TranslationOption[] {
  return TRANSLATION_OPTIONS.filter((t) => t.languageId === lang)
}

export function getTranslationOption(id: string): TranslationOption {
  return TRANSLATION_OPTIONS.find((t) => t.id === id) ?? TRANSLATION_OPTIONS[0]
}

export function isTranslationLanguageId(id: unknown): id is TranslationLanguageId {
  return id === 'en' || id === 'so'
}

export function isTranslationEditionId(id: unknown): id is string {
  return typeof id === 'string' && TRANSLATION_OPTIONS.some((t) => t.id === id)
}

/** Language a given edition id belongs to, e.g. "en.pickthall" → "en". */
export function languageForEdition(editionId: string): TranslationLanguageId {
  return getTranslationOption(editionId).languageId
}
