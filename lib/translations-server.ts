/**
 * A mushaf page's translations in one edition, on the server: from Quran.com
 * for the editions it has, from AlQuran Cloud for the rest, and from the
 * bundled Saheeh International as the last resort. Used by /api/ayah and by
 * the AI translation store (lib/part-translation-store.ts).
 */

import { getTranslationsByPageServer, getVersesByPageServer } from '@/lib/quran-server'
import { quranComTranslationId } from '@/lib/translations'

export const QURAN_API_BASE = process.env.QURAN_API_BASE || 'https://api.quran.com/api/v4'
export const API_TIMEOUT_MS = 20_000

export interface TranslationItem {
  verse_key: string
  text_uthmani: string
  translation: string
}

/** One of AlQuran Cloud's pages in an edition: verse key → translation. Kept a month, like Quran.com's. */
async function alQuranCloudPage(page: number, editionId: string): Promise<Map<string, string>> {
  const response = await fetch(`https://api.alquran.cloud/v1/page/${page}/${editionId}`, {
    next: { revalidate: 60 * 60 * 24 * 30 },
    signal: AbortSignal.timeout(API_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error('AlQuran Cloud translation failed')
  const payload = (await response.json()) as {
    data?: { ayahs?: Array<{ text: string; numberInSurah: number; surah: { number: number } }> }
  }
  return new Map((payload.data?.ayahs || []).map((a) => [`${a.surah.number}:${a.numberInSurah}`, a.text]))
}

/**
 * The translations of the ayat on one of this app's mushaf pages. AlQuran
 * Cloud splits its pages a little differently (56 ayat sit on a neighbouring
 * page there, e.g. 5:77 or 55:17), so an ayah not on its page of the same
 * number is looked for on the pages either side. Asking by page alone left
 * those ayat without a translation.
 */
async function fetchTranslationsFromAlQuranCloud(page: number, editionId: string): Promise<TranslationItem[]> {
  const verses = await getVersesByPageServer(page)
  const found = new Map<string, string>()
  const take = (rows: Map<string, string>) => {
    for (const v of verses) {
      const text = rows.get(v.verse_key)
      if (text && !found.has(v.verse_key)) found.set(v.verse_key, text)
    }
  }
  take(await alQuranCloudPage(page, editionId))
  for (const neighbour of [page - 1, page + 1]) {
    if (found.size >= verses.length) break
    if (neighbour < 1 || neighbour > 604) continue
    try {
      take(await alQuranCloudPage(neighbour, editionId))
    } catch {
      // What was found on the page itself is still worth returning.
    }
  }
  return verses.map((v) => ({
    verse_key: v.verse_key,
    text_uthmani: v.text_uthmani,
    translation: found.get(v.verse_key) ?? '',
  }))
}

/** Quran.com marks footnotes and emphasis with HTML; the app shows plain text. */
function plainTranslation(html: string): string {
  return html
    .replace(/<sup[^>]*>.*?<\/sup>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

/** One mushaf page of one Quran.com translation, verse by verse. */
async function fetchTranslationsFromQuranCom(page: number, translationId: number): Promise<TranslationItem[]> {
  const params = new URLSearchParams({ translations: String(translationId), per_page: '50', fields: 'verse_key' })
  const response = await fetch(`${QURAN_API_BASE}/verses/by_page/${page}?${params.toString()}`, {
    // Translations do not change, so a page is kept for a month.
    next: { revalidate: 60 * 60 * 24 * 30 },
    signal: AbortSignal.timeout(API_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error('Quran.com translation failed')

  const payload = (await response.json()) as {
    verses?: Array<{ verse_key: string; translations?: Array<{ text?: string }> }>
  }
  const offline = await getVersesByPageServer(page)
  const arabicByKey = Object.fromEntries(offline.map((v) => [v.verse_key, v.text_uthmani]))

  return (payload.verses || []).map((verse) => ({
    verse_key: verse.verse_key,
    text_uthmani: arabicByKey[verse.verse_key] || '',
    translation: plainTranslation(verse.translations?.[0]?.text || ''),
  }))
}

export async function fetchTranslationsForPage(page: number, editionId: string): Promise<TranslationItem[]> {
  const quranComId = quranComTranslationId(editionId)
  if (quranComId !== null) {
    try {
      const rows = await fetchTranslationsFromQuranCom(page, quranComId)
      if (rows.some((r) => r.translation.length > 0)) return rows
    } catch (err) {
      console.warn('Quran.com translations failed:', err)
    }
    return []
  }

  try {
    const cloud = await fetchTranslationsFromAlQuranCloud(page, editionId)
    if (cloud.length > 0 && cloud.some((r) => r.translation.length > 0)) {
      return cloud
    }
  } catch (err) {
    console.warn('AlQuran Cloud translations failed:', err)
  }

  if (editionId === 'en.sahih') {
    const offline = await getTranslationsByPageServer(page)
    return offline.filter((r) => r.translation.length > 0)
  }

  return []
}
