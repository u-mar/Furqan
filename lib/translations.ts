/** Translation language options (AlQuran Cloud edition identifiers). */

export type TranslationLanguageId = 'en' | 'so'

export interface TranslationLanguage {
  id: TranslationLanguageId
  label: string
  /** AlQuran Cloud edition slug, e.g. en.sahih */
  editionId: string
}

export const TRANSLATION_LANGUAGES: TranslationLanguage[] = [
  {
    id: 'en',
    label: 'English',
    editionId: 'en.sahih',
  },
  {
    id: 'so',
    label: 'Somali',
    editionId: 'so.abduh',
  },
]

export const DEFAULT_TRANSLATION_LANGUAGE: TranslationLanguageId = 'en'

export function getTranslationLanguage(id: string): TranslationLanguage {
  return TRANSLATION_LANGUAGES.find((l) => l.id === id) ?? TRANSLATION_LANGUAGES[0]
}

export function isTranslationLanguageId(id: string): id is TranslationLanguageId {
  return TRANSLATION_LANGUAGES.some((l) => l.id === id)
}
