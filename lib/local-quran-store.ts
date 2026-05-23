import type { Verse, VerseWord } from '@/types'

interface QuranDataFile {
  chapters: unknown[]
  verses: Verse[]
}

let verses: Verse[] | null = null
let pageIndex: Map<number, Verse[]> | null = null
const hotCache = new Map<number, Verse[]>()

function sortVerses(a: Verse, b: Verse): number {
  const [ac, av] = a.verse_key.split(':').map(Number)
  const [bc, bv] = b.verse_key.split(':').map(Number)
  return ac - bc || av - bv
}

function mergeVerseOnPage(existing: Verse, verse: Verse, words: VerseWord[]): void {
  const merged = new Map<number, VerseWord>()
  for (const w of [...(existing.words || []), ...words]) {
    merged.set(w.id, w)
  }
  existing.words = Array.from(merged.values()).sort((a, b) => a.position - b.position)
}

function buildPageIndex(allVerses: Verse[]): Map<number, Verse[]> {
  const map = new Map<number, Verse[]>()

  for (const verse of allVerses) {
    if (!verse.words?.length) {
      const page = verse.page_number || 1
      const list = map.get(page) || []
      list.push({ ...verse, page_number: page })
      map.set(page, list)
      continue
    }

    const wordsByPage = new Map<number, VerseWord[]>()
    for (const word of verse.words) {
      if (!word.text_uthmani.trim() && word.char_type_name !== 'end') continue
      const page = word.v2_page || word.page_number || verse.page_number || 1
      const bucket = wordsByPage.get(page) || []
      bucket.push(word)
      wordsByPage.set(page, bucket)
    }

    for (const [page, words] of wordsByPage) {
      const list = map.get(page) || []
      const existing = list.find((v) => v.verse_key === verse.verse_key)
      if (existing) {
        mergeVerseOnPage(existing, verse, words)
      } else {
        list.push({
          ...verse,
          page_number: page,
          words: [...words].sort((a, b) => a.position - b.position),
        })
      }
      map.set(page, list)
    }
  }

  for (const [page, list] of map) {
    map.set(page, list.sort(sortVerses))
  }

  return map
}

export function isOfflineReady(): boolean {
  return pageIndex !== null && verses !== null
}

export function getLocalMushafPage(page: number): Verse[] | null {
  if (!pageIndex) return null
  const hit = hotCache.get(page) ?? pageIndex.get(page)
  if (hit?.length) {
    hotCache.set(page, hit)
    return hit
  }
  return null
}

export function prefetchMushafPages(center: number, radius = 2): void {
  if (!pageIndex) return
  for (let p = center - radius; p <= center + radius; p += 1) {
    if (p < 1 || p > 604) continue
    const data = pageIndex.get(p)
    if (data) hotCache.set(p, data)
  }
}

export async function downloadOfflineQuran(
  onProgress?: (percent: number) => void
): Promise<void> {
  onProgress?.(0)

  const response = await fetch('/quran-data.json')
  if (!response.ok) {
    throw new Error('Could not download Quran data. Ensure quran-data.json is deployed.')
  }

  const total = Number(response.headers.get('content-length') || 0)
  let loaded = ''
  const reader = response.body?.getReader()

  if (reader && total > 0) {
    const decoder = new TextDecoder()
    let received = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      received += value.length
      loaded += decoder.decode(value, { stream: true })
      onProgress?.(Math.min(99, Math.round((received / total) * 100)))
    }
    loaded += decoder.decode()
  } else {
    loaded = await response.text()
    onProgress?.(50)
  }

  const data = JSON.parse(loaded) as QuranDataFile
  verses = data.verses
  pageIndex = buildPageIndex(verses)
  hotCache.clear()
  prefetchMushafPages(1, 3)
  onProgress?.(100)
}

/** Hydrate from already-fetched bundle (e.g. after settings flag set). */
export async function hydrateOfflineFromDisk(): Promise<void> {
  if (pageIndex) return
  const response = await fetch('/quran-data.json')
  if (!response.ok) throw new Error('Offline Quran file missing')
  const data = (await response.json()) as QuranDataFile
  verses = data.verses
  pageIndex = buildPageIndex(verses)
}
