import type { Verse, VerseWord } from '@/types'
import { cacheAllMushafFonts, clearOfflineFontsCachedFlag, verifyMushafFontsCached } from '@/lib/offline-font-cache'

interface QuranDataFile {
  bundleVersion?: number
  chapters: unknown[]
  verses: Verse[]
}

let verses: Verse[] | null = null
let pageIndex: Map<number, Verse[]> | null = null
const hotCache = new Map<number, Verse[]>()
const OFFLINE_CACHE_NAME = 'muyassar-offline-v1'
const QURAN_DATA_URL = '/quran-data.json'

export interface OfflineDownloadProgress {
  percent: number
  phase: 'text' | 'fonts' | 'ready'
  label: string
}

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

function ingestQuranData(data: QuranDataFile): void {
  verses = data.verses
  pageIndex = buildPageIndex(verses)
  hotCache.clear()
  prefetchMushafPages(1, 3)
}

function report(
  onProgress: ((p: OfflineDownloadProgress) => void) | undefined,
  patch: OfflineDownloadProgress
): void {
  onProgress?.(patch)
}

async function saveQuranBundleToCache(source: Response): Promise<void> {
  if (typeof caches === 'undefined') return
  const cache = await caches.open(OFFLINE_CACHE_NAME)
  await cache.put(QURAN_DATA_URL, source.clone())
}

async function loadQuranBundleResponse(): Promise<Response> {
  if (typeof caches !== 'undefined') {
    const cache = await caches.open(OFFLINE_CACHE_NAME)
    const cached = await cache.match(QURAN_DATA_URL)
    if (cached) return cached
  }

  const response = await fetch(QURAN_DATA_URL, { cache: 'force-cache' })
  if (!response.ok) throw new Error('Offline Quran file missing')
  return response
}

export async function downloadOfflineQuran(
  onProgress?: (progress: OfflineDownloadProgress) => void
): Promise<void> {
  report(onProgress, { percent: 0, phase: 'text', label: 'Downloading Quran text…' })

  const response = await fetch('/quran-data.json', { cache: 'no-store' })
  if (!response.ok) {
    throw new Error('Could not download Quran data. Run npm run download-quran on the server first.')
  }
  await saveQuranBundleToCache(response)

  const total = Number(response.headers.get('content-length') || 0)
  const body = response.body

  if (body && total > 0) {
    const reader = body.getReader()
    const decoder = new TextDecoder()
    let received = 0
    const parts: Uint8Array[] = []

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value?.length) continue
      parts.push(value)
      received += value.length
      report(onProgress, {
        percent: Math.min(55, Math.round((received / total) * 55)),
        phase: 'text',
        label: 'Downloading Quran text…',
      })
    }

    const merged = new Uint8Array(received)
    let offset = 0
    for (const part of parts) {
      merged.set(part, offset)
      offset += part.length
    }

    const loaded = decoder.decode(merged)
    const data = JSON.parse(loaded) as QuranDataFile
    report(onProgress, { percent: 58, phase: 'text', label: 'Preparing pages…' })
    ingestQuranData(data)
  } else {
    report(onProgress, { percent: 10, phase: 'text', label: 'Downloading Quran text…' })
    const buffer = await response.arrayBuffer()
    report(onProgress, { percent: 55, phase: 'text', label: 'Preparing pages…' })
    const data = JSON.parse(new TextDecoder().decode(buffer)) as QuranDataFile
    ingestQuranData(data)
  }

  const glyphCount = (verses || []).reduce(
    (n, v) => n + (v.words?.filter((w) => w.code_v2).length || 0),
    0
  )
  if (glyphCount === 0) {
    throw new Error(
      'This Quran file is outdated (no mushaf glyphs). Ask the host to run: npm run download-quran'
    )
  }

  report(onProgress, {
    percent: 60,
    phase: 'fonts',
    label: 'Downloading mushaf fonts…',
  })

  await cacheAllMushafFonts((fontProgress) => {
    const fontSlice = 35
    const base = 60
    report(onProgress, {
      percent: base + Math.round((fontProgress.percent / 100) * fontSlice),
      phase: 'fonts',
      label: `Mushaf fonts ${fontProgress.done}/${fontProgress.total}`,
    })
  })

  const fontsOk = await verifyMushafFontsCached()
  if (!fontsOk) {
    clearOfflineFontsCachedFlag()
    throw new Error('Mushaf fonts were not saved. Stay on Wi‑Fi and try again.')
  }

  report(onProgress, { percent: 100, phase: 'ready', label: 'Ready — full mushaf offline' })
}

/** Hydrate from already-fetched bundle (e.g. after settings flag set). */
export async function hydrateOfflineFromDisk(): Promise<void> {
  if (pageIndex) return
  const response = await loadQuranBundleResponse()
  const buffer = await response.arrayBuffer()
  const data = JSON.parse(new TextDecoder().decode(buffer)) as QuranDataFile
  ingestQuranData(data)
}

export function clearOfflineStore(): void {
  verses = null
  pageIndex = null
  hotCache.clear()
  clearOfflineFontsCachedFlag()
}
