import type { Chapter, Verse } from '@/types'

interface QuranData {
  chapters: Chapter[]
  verses: Verse[]
}

let cachedQuranData: QuranData | null = null

async function loadQuranData(): Promise<QuranData> {
  if (cachedQuranData) {
    return cachedQuranData
  }

  try {
    const response = await fetch('/quran-data.json')
    if (!response.ok) {
      throw new Error(`Failed to load Quran data: ${response.statusText}`)
    }
    const data = (await response.json()) as QuranData
    cachedQuranData = data
    return data
  } catch {
    throw new Error(
      'Quran data not found. Please run `npm run download-quran` to generate the offline data file.'
    )
  }
}

export async function getChapters(): Promise<Chapter[]> {
  const data = await loadQuranData()
  return data.chapters
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

export async function getMushafPage(pageNumber: number): Promise<Verse[]> {
  return getVersesByPage(pageNumber)
}

export async function getVisualPageForVerse(verseKey: string, fallbackPage: number): Promise<number> {
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
    return {}
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

export function everyAyahUrl(surah: number, ayah: number): string {
  const surahPadded = String(surah).padStart(3, '0')
  const ayahPadded = String(ayah).padStart(3, '0')
  return `https://everyayah.com/data/Alafasy_128kbps/${surahPadded}${ayahPadded}.mp3`
}
