import { JUZ_STARTS, TOTAL_MUSHAF_PAGES } from '@/lib/mushaf'
import { getOfflineQuranSnapshot } from '@/lib/local-quran-store'
import { getVisualPageForVerse } from '@/lib/quran'
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

export async function resolveJuzPageRange(juz: number): Promise<{ startPage: number; endPage: number }> {
  const snapshot = getOfflineQuranSnapshot()
  if (snapshot?.verses?.length) {
    return juzPageRangeFromVerses(snapshot.verses, juz)
  }

  const startPage = await getVisualPageForVerse(juzStartVerseKey(juz), 1)
  if (juz >= 30) {
    return { startPage, endPage: TOTAL_MUSHAF_PAGES }
  }
  const nextStart = await getVisualPageForVerse(juzStartVerseKey(juz + 1), startPage + 1)
  return { startPage, endPage: Math.max(startPage, nextStart - 1) }
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
