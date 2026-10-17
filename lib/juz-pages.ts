import { JUZ_STARTS, TOTAL_MUSHAF_PAGES } from '@/lib/mushaf'
import mushafPageIndex from '@/lib/mushaf-page-index.json'
import type { Verse } from '@/types'

export function juzStartVerseKey(juz: number): string {
  const start = JUZ_STARTS[juz - 1]
  if (!start) return '1:1'
  return `${start.surah}:${start.ayah}`
}

function pageFromVerse(verse: Verse): number {
  const word = verse.words?.find((w) => w.char_type_name !== 'end') ?? verse.words?.[0]
  return word?.v2_page || word?.page_number || verse.page_number || 1
}

/** Page span for a juz from bundled verse metadata (sync, offline-safe). */
export function juzPageRangeFromVerses(allVerses: Verse[], juz: number): { startPage: number; endPage: number } {
  const inJuz = allVerses.filter((v) => v.juz_number === juz)
  if (inJuz.length === 0) {
    const startPage = Math.max(1, Math.ceil((juz - 1) * (TOTAL_MUSHAF_PAGES / 30)))
    const endPage =
      juz >= 30 ? TOTAL_MUSHAF_PAGES : Math.max(startPage, Math.ceil((juz * TOTAL_MUSHAF_PAGES) / 30) - 1)
    return { startPage, endPage }
  }

  let startPage = TOTAL_MUSHAF_PAGES
  let endPage = 1
  for (const verse of inJuz) {
    const page = pageFromVerse(verse)
    startPage = Math.min(startPage, page)
    endPage = Math.max(endPage, page)
  }
  return { startPage, endPage }
}

/** A juz's first and last page, from the page facts shipped with the app (lib/mushaf-page-index.json). */
export async function resolveJuzPageRange(juz: number): Promise<{ startPage: number; endPage: number }> {
  const range = mushafPageIndex.juz[Math.min(30, Math.max(1, juz)) - 1]
  return { startPage: range[0], endPage: range[1] }
}

/** The page a surah starts on. */
export function surahStartPage(surah: number): number {
  return mushafPageIndex.surah[Math.min(114, Math.max(1, surah)) - 1] ?? 1
}

export function splitPageRange(
  startPage: number,
  endPage: number,
  partIndex: number,
  partCount: number
): { startPage: number; endPage: number } {
  if (partCount <= 1) return { startPage, endPage }
  const span = endPage - startPage + 1
  const size = Math.ceil(span / partCount)
  const start = startPage + partIndex * size
  const end = Math.min(endPage, start + size - 1)
  return { startPage: start, endPage: Math.max(start, end) }
}
