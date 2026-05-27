import type { Chapter, Verse } from '@/types'
import {
  ensureOfflineHydrated,
  getLocalMushafPage,
  getOfflineQuranSnapshot,
  hydrateOfflineFromDisk,
  isOfflineReady,
  prefetchMushafPages,
} from '@/lib/local-quran-store'

interface QuranData {
  chapters: Chapter[]
  verses: Verse[]
}

let cachedQuranData: QuranData | null = null

function pageFromVerse(verse: Verse): number {
  const first = verse.words?.[0]
  return first?.v2_page || first?.page_number || verse.page_number || 1
}

export async function loadQuranData(): Promise<QuranData> {
  if (cachedQuranData) {
    return cachedQuranData
  }

  await ensureOfflineHydrated()
  const offline = getOfflineQuranSnapshot()
  if (offline?.verses.length) {
    cachedQuranData = {
      chapters: offline.chapters.length ? offline.chapters : buildChaptersFromVerses(offline.verses),
      verses: offline.verses,
    }
    return cachedQuranData
  }

  try {
    const response = await fetch('/quran-data.json', { cache: 'force-cache' })
    if (!response.ok) {
      throw new Error(`Failed to load Quran data: ${response.statusText}`)
    }
    const data = (await response.json()) as QuranData
    cachedQuranData = data
    return data
  } catch {
    throw new Error(
      'Quran data not found. Download the Quran in Settings or run `npm run download-quran`.'
    )
  }
}

function buildChaptersFromVerses(verses: Verse[]): Chapter[] {
  const counts = new Map<number, number>()
  for (const verse of verses) {
    const id = Number(verse.verse_key.split(':')[0])
    if (!id) continue
    counts.set(id, (counts.get(id) || 0) + 1)
  }
  return Array.from(counts.entries())
    .sort(([a], [b]) => a - b)
    .map(([id, versesCount]) => ({
      id,
      name: '',
      englishName: `Surah ${id}`,
      versesCount,
    }))
}

let cachedChapters: Chapter[] | null = null

export async function getChapters(): Promise<Chapter[]> {
  if (cachedChapters) return cachedChapters

  try {
    const response = await fetch('/quran-chapters.json', { cache: 'force-cache' })
    if (!response.ok) throw new Error()
    const data = (await response.json()) as {
      chapters: Array<{ id: number; name_arabic: string; name_simple: string; verses_count: number }>
    }
    cachedChapters = data.chapters.map((c) => ({
      id: c.id,
      name: c.name_arabic,
      englishName: c.name_simple,
      versesCount: c.verses_count,
    }))
    return cachedChapters
  } catch {
    const data = await loadQuranData()
    cachedChapters = data.chapters
    return cachedChapters
  }
}

export async function getVersesByChapter(chapterNumber: number): Promise<Verse[]> {
  const data = await loadQuranData()
  return data.verses.filter((v) => v.verse_key.startsWith(`${chapterNumber}:`))
}

export async function getVersesByJuz(juzNumber: number): Promise<Verse[]> {
  const data = await loadQuranData()
  return data.verses.filter((v) => v.juz_number === juzNumber)
}

export async function getVersesByPage(pageNumber: number): Promise<Verse[]> {
  const data = await loadQuranData()
  return data.verses.filter((v) => v.page_number === pageNumber)
}

async function tryLocalMushafPage(pageNumber: number): Promise<Verse[] | null> {
  await ensureOfflineHydrated()
  const local = getLocalMushafPage(pageNumber)
  if (local?.length) {
    prefetchMushafPages(pageNumber, 3)
    return local
  }
  return null
}

export async function getMushafPage(pageNumber: number): Promise<Verse[]> {
  const local = await tryLocalMushafPage(pageNumber)
  if (local) return local

  const online = typeof navigator !== 'undefined' ? navigator.onLine : true
  if (!online) {
    throw new Error('This page is not available offline. Download the Quran in Settings.')
  }

  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 45_000)

  try {
    const response = await fetch(`/api/ayah?type=page&page=${pageNumber}`, {
      signal: controller.signal,
    })
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string }
      throw new Error(body.error || `Failed to load page (${response.status})`)
    }
    const verses = (await response.json()) as Verse[]
    if (verses.length === 0) {
      throw new Error('No verses returned for this page')
    }
    prefetchMushafPages(pageNumber, 1)
    return verses
  } catch (err) {
    const fallback = await tryLocalMushafPage(pageNumber)
    if (fallback) return fallback
    try {
      await hydrateOfflineFromDisk()
      const retry = getLocalMushafPage(pageNumber)
      if (retry?.length) return retry
    } catch {
      /* bundled offline file is optional */
    }
    throw err
  } finally {
    window.clearTimeout(timeout)
  }
}

export async function getVisualPageForVerse(verseKey: string, fallbackPage: number): Promise<number> {
  try {
    const verse = await getVerseByKey(verseKey)
    return pageFromVerse(verse)
  } catch {
    /* fall through to API */
  }

  const online = typeof navigator !== 'undefined' ? navigator.onLine : true
  if (!online) return fallbackPage

  try {
    const response = await fetch(`/api/ayah?type=visual-page&verseKey=${encodeURIComponent(verseKey)}`)
    if (!response.ok) {
      throw new Error(`Failed to load visual page: ${response.statusText}`)
    }

    const data = (await response.json()) as { page?: number }
    return data.page || fallbackPage
  } catch {
    return fallbackPage
  }
}

export async function getVisualPagesForScope(scope: {
  chapter?: number
  juz?: number
}): Promise<Record<string, number>> {
  try {
    const params = new URLSearchParams({ type: 'visual-pages' })
    if (scope.chapter) params.set('chapter', String(scope.chapter))
    if (scope.juz) params.set('juz', String(scope.juz))

    const response = await fetch(`/api/ayah?${params.toString()}`)
    if (!response.ok) {
      throw new Error(`Failed to load visual pages: ${response.statusText}`)
    }

    const data = (await response.json()) as { pages?: Record<string, number> }
    return data.pages || {}
  } catch {
    const data = await loadQuranData()
    const verses = scope.chapter
      ? data.verses.filter((v) => v.verse_key.startsWith(`${scope.chapter}:`))
      : scope.juz
        ? data.verses.filter((v) => v.juz_number === scope.juz)
        : []
    const pages: Record<string, number> = {}
    for (const verse of verses) {
      pages[verse.verse_key] = pageFromVerse(verse)
    }
    return pages
  }
}

export async function getVerseByKey(verseKey: string): Promise<Verse> {
  const data = await loadQuranData()
  const verse = data.verses.find((v) => v.verse_key === verseKey)
  if (!verse) {
    throw new Error(`Verse not found: ${verseKey}`)
  }
  return verse
}

export function everyAyahUrl(surah: number, ayah: number, reciterFolder = 'Alafasy_128kbps'): string {
  const surahPadded = String(surah).padStart(3, '0')
  const ayahPadded = String(ayah).padStart(3, '0')
  return `https://everyayah.com/data/${reciterFolder}/${surahPadded}${ayahPadded}.mp3`
}
