import type { Verse } from '@/types'

export interface NormalizedUthmaniVerse {
  id: number
  verseKey: string
  text: string
  page: number
}

/** Uthmani QCF rendering uses verse.code_v2 only. Do not derive this from words[]. */
export function normalizeUthmaniPage(verses: Verse[]): NormalizedUthmaniVerse[] {
  return verses
    .map((verse) => ({
      id: verse.id,
      verseKey: verse.verse_key,
      text: verse.code_v2 ?? '',
      page: verse.page_number ?? 1,
    }))
    .filter((verse) => verse.text.length > 0)
}
