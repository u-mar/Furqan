'use client'

import type { Verse } from '@/types'

/**
 * The last weekly verse this phone showed. Neither the Quran nor a given
 * translation of it changes, so once the verse is known to still be this one
 * the home card draws straight from here instead of fetching it again.
 */
export interface WeeklyVerseCache {
  verseKey: string
  surahName: string
  verse: Verse
  /** By translation edition, so switching language back is instant too. */
  translations: Record<string, string>
  /** When the server last said this is the current weekly verse; 0 if never. */
  confirmedAt: number
}

const CACHE_KEY = 'muyassar_weekly_verse_v1'

export function readWeeklyVerseCache(): WeeklyVerseCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    const parsed = raw ? (JSON.parse(raw) as WeeklyVerseCache) : null
    if (!parsed?.verseKey || !parsed.verse) return null
    return { ...parsed, translations: parsed.translations ?? {}, confirmedAt: parsed.confirmedAt ?? 0 }
  } catch {
    return null
  }
}

export function writeWeeklyVerseCache(next: WeeklyVerseCache): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(next))
  } catch {
    // Storage full or blocked: the card still works, it just fetches next time.
  }
}

/** Called when the weekly verse is changed from this phone, so it never shows the old one. */
export function forgetWeeklyVerse(): void {
  try {
    localStorage.removeItem(CACHE_KEY)
  } catch {
    // Nothing to forget.
  }
}
