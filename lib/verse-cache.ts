import type { Verse } from '@/types'

const PREFIX = 'hifdh_verse_pool_v1'

export function versePoolCacheKey(
  mode: string,
  surah: number,
  juz: number,
  startAyah: number,
  endAyah: number
): string {
  return `${PREFIX}:${mode}:${surah}:${juz}:${startAyah}:${endAyah}`
}

export function readVersePoolCache(key: string): Verse[] | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Verse[]
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function writeVersePoolCache(key: string, verses: Verse[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(key, JSON.stringify(verses))
  } catch {
    /* storage full or disabled */
  }
}
