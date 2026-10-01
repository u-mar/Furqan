import { CATALOG_LANGUAGE_LABELS, CATALOG_TRANSLATIONS } from '@/lib/translations-catalog'

/**
 * Translation languages and their editions.
 *
 * Two sources: the editions the app has always had (AlQuran Cloud identifiers
 * such as "en.sahih"), which also work offline, and everything the Quran.com API
 * offers (`qf.<id>`, see translations-catalog.ts), which needs a connection.
 */

/** A language code, e.g. "en", "so", "ur", "fr". */
export type TranslationLanguageId = string

export interface TranslationOption {
  /** Unique edition id: an AlQuran Cloud identifier ("en.sahih") or a Quran.com one ("qf.85"). */
  id: string
  languageId: TranslationLanguageId
  /** Translator/edition display name. */
  label: string
}

/** The editions that are also kept for offline reading. */
const CORE_OPTIONS: TranslationOption[] = [
  { id: 'en.sahih', languageId: 'en', label: 'Saheeh International' },
  { id: 'en.yusufali', languageId: 'en', label: 'Abdullah Yusuf Ali' },
  { id: 'en.pickthall', languageId: 'en', label: 'Marmaduke Pickthall' },
  { id: 'so.abduh', languageId: 'so', label: 'Mahmud Muhammad Abduh' },
]

/** Every translation edition the app can show, grouped implicitly by languageId. */
export const TRANSLATION_OPTIONS: TranslationOption[] = [
  ...CORE_OPTIONS,
  ...CATALOG_TRANSLATIONS.filter(
    // The same translators as the four above, which are the ones that also work offline.
    (t) => !(t.languageId === 'en' && ['Saheeh International', 'M. Pickthall', 'A. Yusuf Ali'].includes(t.label))
  ).map((t): TranslationOption => ({ id: t.id, languageId: t.languageId, label: t.label })),
]

export const DEFAULT_TRANSLATION_LANGUAGE: TranslationLanguageId = 'en'

/** Editions written in Latin letters rather than their language's own script, e.g. Roman Urdu. */
function isLatinScriptEdition(option: TranslationOption): boolean {
  return /\b(roman|latin|transliteration)\b/i.test(option.label)
}

/**
 * The edition each language falls back to — for English and Somali also the
 * one available offline. One in the language's own script when there is one,
 * so Urdu opens in Urdu letters rather than Roman Urdu.
 */
export const DEFAULT_TRANSLATION_EDITION: Record<TranslationLanguageId, string> = (() => {
  const map: Record<string, string> = {}
  for (const option of TRANSLATION_OPTIONS) {
    if (isLatinScriptEdition(option)) continue
    if (!map[option.languageId]) map[option.languageId] = option.id
  }
  for (const option of TRANSLATION_OPTIONS) if (!map[option.languageId]) map[option.languageId] = option.id
  return map
})()

/** Languages that keep their own translation editions for offline use. */
export const OFFLINE_TRANSLATION_LANGUAGES: TranslationLanguageId[] = ['en', 'so']

const LANGUAGE_LABELS: Record<TranslationLanguageId, string> = {
  ...CATALOG_LANGUAGE_LABELS,
  en: 'English',
  so: 'Somali',
}

/** Every language there is a translation in: English and Somali first, then A to Z. */
export const TRANSLATION_LANGUAGES: TranslationLanguageId[] = [
  'en',
  'so',
  ...Object.keys(DEFAULT_TRANSLATION_EDITION)
    .filter((id) => id !== 'en' && id !== 'so')
    .sort((a, b) => translationLanguageLabel(a).localeCompare(translationLanguageLabel(b))),
]

export function translationLanguageLabel(lang: TranslationLanguageId): string {
  return LANGUAGE_LABELS[lang] ?? lang
}

/** Read right to left: their translation text is set that way. */
const RTL_LANGUAGES = new Set(['ar', 'ur', 'fa', 'ps', 'sd', 'ug', 'ku', 'dari', 'he', 'dv'])

export function isRtlTranslationLanguage(lang: TranslationLanguageId): boolean {
  return RTL_LANGUAGES.has(lang)
}

/** Whether an edition's text runs right to left: its language does, and it is not in Latin letters. */
export function isRtlTranslationEdition(editionId: string): boolean {
  const option = getTranslationOption(editionId)
  return isRtlTranslationLanguage(option.languageId) && !isLatinScriptEdition(option)
}

export function translationsForLanguage(lang: TranslationLanguageId): TranslationOption[] {
  return TRANSLATION_OPTIONS.filter((t) => t.languageId === lang)
}

export function getTranslationOption(id: string): TranslationOption {
  return TRANSLATION_OPTIONS.find((t) => t.id === id) ?? TRANSLATION_OPTIONS[0]
}

export function isTranslationLanguageId(id: unknown): id is TranslationLanguageId {
  return typeof id === 'string' && id in DEFAULT_TRANSLATION_EDITION
}

export function isTranslationEditionId(id: unknown): id is string {
  return typeof id === 'string' && TRANSLATION_OPTIONS.some((t) => t.id === id)
}

/** Language a given edition id belongs to, e.g. "en.pickthall" → "en". */
export function languageForEdition(editionId: string): TranslationLanguageId {
  return getTranslationOption(editionId).languageId
}

/** The Quran.com translation number inside an id like "qf.85", or null for the older editions. */
export function quranComTranslationId(editionId: string): number | null {
  const match = /^qf\.(\d+)$/.exec(editionId)
  return match ? Number(match[1]) : null
}
