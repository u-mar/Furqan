/**
 * An ayah as the Qari screens draw it: the mushaf's own QCF glyphs (or plain
 * Uthmani text when a page has none), plus its English translation.
 *
 * Shared by the swipe view and the share video, so both read the same script
 * and neither fetches the same verse or page of translations twice.
 */

import { compareMushafWords, wordOnVisualPage } from '@/lib/mushaf-engine/word-order'
import { loadPageFont, qcfPageFontFamily } from '@/lib/mushaf-fonts'
import { pageHasQcfData, versePageNumber } from '@/lib/qcf-page'
import { getVerseArabicText } from '@/lib/quran-display'
import { getVerseByKey } from '@/lib/quran'
import type { Verse } from '@/types'

/** The ayah's own QCF glyphs, one array entry per word (so they wrap and
 *  space like real words), in reading order, with the ayah-end ornament left
 *  out. Empty when the verse has no QCF data for this page. */
export function verseQcfWords(verse: Verse, pageNumber: number): string[] {
  const items = (verse.words || [])
    .filter(
      (w) => w.char_type_name !== 'end' && wordOnVisualPage(w, pageNumber, verse) && Boolean(w.code_v2?.trim())
    )
    .map((w) => ({ ...w, verseKey: verse.verse_key }))
  items.sort(compareMushafWords)
  return items.map((w) => w.code_v2!.trim())
}

const pageTranslations = new Map<number, Promise<Map<string, string>>>()

/** A page's translations, fetched once and reused for every ayah on it. */
export function fetchPageTranslations(page: number): Promise<Map<string, string>> {
  let pending = pageTranslations.get(page)
  if (!pending) {
    pending = (async () => {
      const map = new Map<string, string>()
      try {
        const res = await fetch(`/api/ayah?type=translations&page=${page}&lang=en&edition=en.sahih`)
        const data: unknown = await res.json()
        if (Array.isArray(data)) {
          for (const row of data as { verse_key?: string; translation?: string }[]) {
            if (row.verse_key && row.translation) map.set(row.verse_key, row.translation)
          }
        }
      } catch {
        // No translation for this page — the ayah just shows on its own.
        pageTranslations.delete(page)
      }
      return map
    })()
    pageTranslations.set(page, pending)
  }
  return pending
}

export interface AyahView {
  verseKey: string
  /** One entry per word, in reading order. */
  words: string[]
  /** A CSS font-family value that draws `words`. */
  fontFamily: string
  /** True for the mushaf glyph font, which must never be drawn bold. */
  qcf: boolean
  /** null when none could be found. */
  translation: string | null
}

const loaded = new Map<string, AyahView>()
const loading = new Map<string, Promise<AyahView | null>>()

/** The ayah if it has already been loaded, so a screen can draw it without waiting. */
export function peekAyah(verseKey: string): AyahView | null {
  return loaded.get(verseKey) ?? null
}

/** Loads an ayah, its page font and its translation. Null if the verse cannot be found. */
export function loadAyah(verseKey: string): Promise<AyahView | null> {
  const known = loaded.get(verseKey)
  if (known) return Promise.resolve(known)
  let pending = loading.get(verseKey)
  if (!pending) {
    pending = (async () => {
      try {
        const verse = await getVerseByKey(verseKey)
        const page = versePageNumber(verse)
        const qcfWords = pageHasQcfData([verse]) ? verseQcfWords(verse, page) : []
        const [fontLoaded, translations] = await Promise.all([
          qcfWords.length > 0 ? loadPageFont(page, qcfWords.join('').slice(0, 12)) : Promise.resolve(false),
          fetchPageTranslations(page),
        ])
        const view: AyahView = {
          verseKey,
          words: fontLoaded ? qcfWords : getVerseArabicText(verse, { omitEndMark: true }).split(/\s+/),
          fontFamily: fontLoaded ? `"${qcfPageFontFamily(page)}"` : 'var(--font-amiri), Amiri, serif',
          qcf: fontLoaded,
          translation: translations.get(verseKey)?.replace(/\s+/g, ' ').trim() || null,
        }
        loaded.set(verseKey, view)
        return view
      } catch {
        return null
      } finally {
        loading.delete(verseKey)
      }
    })()
    loading.set(verseKey, pending)
  }
  return pending
}
