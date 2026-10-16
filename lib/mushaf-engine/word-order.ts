import type { Verse, VerseWord } from '@/types'

/** Stable surah:ayah ordering (numeric, not string sort). */
export function verseOrder(verseKey: string): number {
  const [surah, ayah] = verseKey.split(':').map(Number)
  return (surah || 0) * 1000 + (ayah || 0)
}

export function sortVersesByKey(verses: Verse[]): Verse[] {
  return [...verses].sort((a, b) => verseOrder(a.verse_key) - verseOrder(b.verse_key))
}

/**
 * Words the published line data puts one line early. Each is the last word of
 * its line in the data, but the page's own font is cut for it to start the
 * next line, as in the printed mushaf, so the data's line ran wide and the
 * next fell short (and the whole page was shrunk to fit the wide one). Found
 * by measuring every line of all 604 pages in its own font.
 */
const LINE_CORRECTIONS: Record<string, number> = {
  '2:181:5': 15, // page 27
  '8:6:10': 12, // page 177
  '29:33:11': 6, // page 400
  '36:52:10': 13, // page 443
  '84:21:7': 14, // page 589
}

/** The printed line a word sits on, with the known slips in the data put right. */
export function mushafLine(word: Pick<VerseWord, 'line_number' | 'position'>, verseKey: string): number {
  return LINE_CORRECTIONS[`${verseKey}:${word.position}`] ?? word.line_number ?? 1
}

export function wordVisualPage(word: VerseWord, verse: Verse): number {
  return word.v2_page || word.page_number || verse.page_number || 0
}

export function wordOnVisualPage(word: VerseWord, pageNumber: number, verse: Verse): boolean {
  return wordVisualPage(word, verse) === pageNumber
}

/**
 * Deterministic mushaf word order (do NOT rely on API array order).
 * 1. printed mushaf row (mushafLine)
 * 2. verse key (surah:ayah on shared lines)
 * 3. word position within ayah
 * 4. word id (API tiebreaker)
 */
export function compareMushafWords(
  a: VerseWord & { verseKey: string },
  b: VerseWord & { verseKey: string }
): number {
  const lineDiff = mushafLine(a, a.verseKey) - mushafLine(b, b.verseKey)
  if (lineDiff !== 0) return lineDiff

  const verseDiff = verseOrder(a.verseKey) - verseOrder(b.verseKey)
  if (verseDiff !== 0) return verseDiff

  const posDiff = a.position - b.position
  if (posDiff !== 0) return posDiff

  return a.id - b.id
}
