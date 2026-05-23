import {
  qcfCdnFontUrl,
  qcfLocalFontUrl,
  SURAH_NAME_FONT_URL,
  TOTAL_MUSHAF_FONT_PAGES,
} from '@/lib/qcf-font-cdn'

const CACHE_NAME = 'muyassar-qcf-fonts-v2'
const SURAH_CACHE_KEY = '/fonts/surah-name-v2.ttf'

export function areOfflineFontsCached(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem('muyassar_fonts_cached') === '1'
  } catch {
    return false
  }
}

export function markOfflineFontsCached(): void {
  try {
    localStorage.setItem('muyassar_fonts_cached', '1')
  } catch {
    /* ignore */
  }
}

export function clearOfflineFontsCachedFlag(): void {
  try {
    localStorage.removeItem('muyassar_fonts_cached')
  } catch {
    /* ignore */
  }
}

async function openCache(): Promise<Cache> {
  return caches.open(CACHE_NAME)
}

/** Prefer Cache API, then same-origin bundle, then CDN. */
export async function resolveQcfFontUrl(page: number): Promise<string> {
  if (page < 1 || page > TOTAL_MUSHAF_FONT_PAGES) return qcfCdnFontUrl(page)

  const local = qcfLocalFontUrl(page)

  if (typeof caches !== 'undefined') {
    try {
      const cache = await caches.open(CACHE_NAME)
      const hit = await cache.match(local)
      if (hit) {
        const blob = await hit.blob()
        return URL.createObjectURL(blob)
      }
    } catch {
      /* ignore */
    }
  }

  try {
    const head = await fetch(local, { method: 'HEAD' })
    if (head.ok) return local
  } catch {
    /* not bundled */
  }

  return qcfCdnFontUrl(page)
}

export async function resolveSurahNameFontUrl(): Promise<string> {
  const local = '/fonts/surah-name-v2.ttf'
  try {
    const head = await fetch(local, { method: 'HEAD' })
    if (head.ok) return local
  } catch {
    /* ignore */
  }

  if (typeof caches !== 'undefined') {
    try {
      const cache = await caches.open(CACHE_NAME)
      const hit = await cache.match(SURAH_CACHE_KEY)
      if (hit) return hit.url
    } catch {
      /* ignore */
    }
  }

  return SURAH_NAME_FONT_URL
}

export interface FontCacheProgress {
  percent: number
  done: number
  total: number
}

async function cacheFont(
  cache: Cache,
  requestUrl: string,
  cacheKey: string
): Promise<boolean> {
  try {
    const existing = await cache.match(cacheKey)
    if (existing) return true

    const response = await fetch(requestUrl, { mode: 'cors' })
    if (!response.ok) return false
    await cache.put(cacheKey, response.clone())
    return true
  } catch {
    return false
  }
}

/** Download all page fonts + surah header font for true offline mushaf rendering. */
export async function cacheAllMushafFonts(
  onProgress?: (p: FontCacheProgress) => void
): Promise<void> {
  if (typeof caches === 'undefined') {
    throw new Error('Font caching is not supported in this browser.')
  }

  const cache = await openCache()
  const total = TOTAL_MUSHAF_FONT_PAGES + 1
  let done = 0

  const report = () => {
    onProgress?.({
      done,
      total,
      percent: Math.min(99, Math.round((done / total) * 100)),
    })
  }

  report()

  await cacheFont(cache, SURAH_NAME_FONT_URL, SURAH_CACHE_KEY)
  done += 1
  report()

  const concurrency = 6
  let nextPage = 1

  async function worker(): Promise<void> {
    while (nextPage <= TOTAL_MUSHAF_FONT_PAGES) {
      const page = nextPage
      nextPage += 1

      const localKey = qcfLocalFontUrl(page)
      const bundledOk = await cacheFont(cache, localKey, localKey)
      if (!bundledOk) {
        await cacheFont(cache, qcfCdnFontUrl(page), localKey)
      }

      done += 1
      report()
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()))

  markOfflineFontsCached()
  onProgress?.({ done: total, total, percent: 100 })
}
