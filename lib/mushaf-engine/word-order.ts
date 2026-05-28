import type { Verse, VerseWord } from '@/types'

/** Stable surah:ayah ordering (numeric, not string sort). */
export function verseOrder(verseKey: string): number {
  const [surah, ayah] = verseKey.split(':').map(Number)
  return (surah || 0) * 1000 + (ayah || 0)
}

export function sortVersesByKey(verses: Verse[]): Verse[] {
  return [...verses].sort((a, b) => verseOrder(a.verse_key) - verseOrder(b.verse_key))
}

export function wordVisualPage(word: VerseWord, verse: Verse): number {
  return word.v2_page || word.page_number || verse.page_number || 0
}

export function wordOnVisualPage(word: VerseWord, pageNumber: number, verse: Verse): boolean {
  return wordVisualPage(word, verse) === pageNumber
}

/**
 * Deterministic mushaf word order (do NOT rely on API array order).
 * 1. line_number (printed mushaf row)
 * 2. verse key (surah:ayah on shared lines)
 * 3. word position within ayah
 * 4. word id (API tiebreaker)
 */
export function compareMushafWords(
  a: VerseWord & { verseKey: string },
  b: VerseWord & { verseKey: string }
): number {
  const lineDiff = (a.line_number ?? 1) - (b.line_number ?? 1)
  if (lineDiff !== 0) return lineDiff

  const verseDiff = verseOrder(a.verseKey) - verseOrder(b.verseKey)
  if (verseDiff !== 0) return verseDiff

  const posDiff = a.position - b.position
  if (posDiff !== 0) return posDiff

  return a.id - b.id
}
