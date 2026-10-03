/**
 * An ayah as the Qari screens draw it: the mushaf's own QCF glyphs (or plain
 * Uthmani text when a page has none), plus its translation in the viewer's
 * own language — the translation they read the Quran with, whoever recited.
 *
 * Shared by the swipe view and the share video, so both read the same script
 * and neither fetches the same verse or page of translations twice.
 */

import { compareMushafWords, wordOnVisualPage } from '@/lib/mushaf-engine/word-order'
import { loadPageFont, qcfPageFontFamily } from '@/lib/mushaf-fonts'
import { pageHasQcfData, versePageNumber } from '@/lib/qcf-page'
import { getVerseArabicText } from '@/lib/quran-display'
import { getVerseByKey } from '@/lib/quran'
import { isRtlTranslationEdition, isTranslationEditionId, languageForEdition } from '@/lib/translations'
import type { Verse } from '@/types'

/** The ayah's own QCF glyphs, one array entry per word (so they wrap and
 *  space like real words), in reading order, with the ayah-end ornament left
 *  out. Empty when the verse has no QCF data for this page. */
export function verseQcfWords(verse: Verse, pageNumber: number): string[] {
  return qcfWordItems(verse, pageNumber).map((w) => w.code_v2!.trim())
}

function qcfWordItems(verse: Verse, pageNumber: number) {
  const items = (verse.words || [])
    .filter(
      (w) => w.char_type_name !== 'end' && wordOnVisualPage(w, pageNumber, verse) && Boolean(w.code_v2?.trim())
    )
    .map((w) => ({ ...w, verseKey: verse.verse_key }))
  items.sort(compareMushafWords)
  return items
}

/** The mushaf's pause marks (waqf signs: ۖ ۗ ۚ ۛ and the rest), where a reciter may stop. */
const PAUSE_MARK = /[ۖ-ۜ]/
const ONLY_MARKS = /^[ۖ-۝٠-٩]+$/

/** The ayah's words in plain Uthmani text, with a pause mark that stands apart joined to the word before it. */
function uthmaniWords(text: string): { words: string[]; pauseAfter: boolean[] } {
  const words: string[] = []
  const pauseAfter: boolean[] = []
  for (const token of text.split(/\s+/).filter(Boolean)) {
    if (ONLY_MARKS.test(token) && words.length) {
      words[words.length - 1] += ` ${token}`
      if (PAUSE_MARK.test(token)) pauseAfter[pauseAfter.length - 1] = true
      continue
    }
    words.push(token)
    pauseAfter.push(PAUSE_MARK.test(token))
  }
  return { words, pauseAfter }
}

const arabicDigits = (n: number) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)])

/** When there is no reading translation to go by. */
const FALLBACK_EDITION = 'en.sahih'

/**
 * The translation a viewer sees under the ayat: the one they read the Quran
 * with (Settings and the Read screen), so each person gets their own language.
 */
export function viewerTranslation(readingEdition: string | null | undefined): string {
  return isTranslationEditionId(readingEdition) ? readingEdition : FALLBACK_EDITION
}

const pageTranslations = new Map<string, Promise<Map<string, string>>>()

/** A page's translations in one edition, fetched once and reused for every ayah on it. */
export function fetchPageTranslations(page: number, edition: string = FALLBACK_EDITION): Promise<Map<string, string>> {
  const cacheKey = `${edition}:${page}`
  let pending = pageTranslations.get(cacheKey)
  if (!pending) {
    pending = (async () => {
      const map = new Map<string, string>()
      try {
        const lang = languageForEdition(edition)
        const res = await fetch(`/api/ayah?type=translations&page=${page}&lang=${lang}&edition=${encodeURIComponent(edition)}`)
        const data: unknown = await res.json()
        if (Array.isArray(data)) {
          for (const row of data as { verse_key?: string; translation?: string }[]) {
            if (row.verse_key && row.translation) map.set(row.verse_key, row.translation)
          }
        }
      } catch {
        // No translation for this page — the ayah just shows on its own.
        pageTranslations.delete(cacheKey)
      }
      return map
    })()
    pageTranslations.set(cacheKey, pending)
  }
  return pending
}

export interface AyahView {
  verseKey: string
  /** One entry per word, in reading order. */
  words: string[]
  /** For each word, whether the mushaf marks a pause after it. */
  pauseAfter: boolean[]
  /** The ayah-end ornament with its number, in the same font as `words`. */
  endMark: string | null
  /** A CSS font-family value that draws `words`. */
  fontFamily: string
  /** True for the mushaf glyph font, which must never be drawn bold. */
  qcf: boolean
  /** null when none could be found. */
  translation: string | null
  /** The translation's language reads right to left (Urdu, Persian…). */
  translationRtl: boolean
  /** Its language code, for the `lang` attribute. */
  translationLang: string
}

const loaded = new Map<string, AyahView>()
const loading = new Map<string, Promise<AyahView | null>>()

function viewKey(verseKey: string, edition: string): string {
  return `${edition}|${verseKey}`
}

/** The ayah if it has already been loaded, so a screen can draw it without waiting. */
export function peekAyah(verseKey: string, edition: string = FALLBACK_EDITION): AyahView | null {
  return loaded.get(viewKey(verseKey, edition)) ?? null
}

/** Loads an ayah, its page font and its translation. Null if the verse cannot be found. */
export function loadAyah(verseKey: string, edition: string = FALLBACK_EDITION): Promise<AyahView | null> {
  const key = viewKey(verseKey, edition)
  const known = loaded.get(key)
  if (known) return Promise.resolve(known)
  let pending = loading.get(key)
  if (!pending) {
    pending = (async () => {
      try {
        const verse = await getVerseByKey(verseKey)
        const page = versePageNumber(verse)
        const qcfItems = pageHasQcfData([verse]) ? qcfWordItems(verse, page) : []
        const qcfWords = qcfItems.map((w) => w.code_v2!.trim())
        const [fontLoaded, translations] = await Promise.all([
          qcfWords.length > 0 ? loadPageFont(page, qcfWords.join('').slice(0, 12)) : Promise.resolve(false),
          fetchPageTranslations(page, edition),
        ])
        const lang = languageForEdition(edition)
        const view: AyahView = {
          verseKey,
          ...(fontLoaded
            ? {
                words: qcfWords,
                pauseAfter: qcfItems.map((w) => PAUSE_MARK.test(w.text_uthmani || '')),
                endMark: verse.words?.find((w) => w.char_type_name === 'end')?.code_v2?.trim() || null,
              }
            : {
                ...uthmaniWords(getVerseArabicText(verse, { omitEndMark: true })),
                endMark: `﴿${arabicDigits(Number(verseKey.split(':')[1]))}﴾`,
              }),
          fontFamily: fontLoaded ? `"${qcfPageFontFamily(page)}"` : 'var(--font-amiri), Amiri, serif',
          qcf: fontLoaded,
          translation: translations.get(verseKey)?.replace(/\s+/g, ' ').trim() || null,
          translationRtl: isRtlTranslationEdition(edition),
          translationLang: lang,
        }
        loaded.set(key, view)
        return view
      } catch {
        return null
      } finally {
        loading.delete(key)
      }
    })()
    loading.set(key, pending)
  }
  return pending
}
