import {
  qcfCdnFontUrl,
  qcfLegacyLocalFontUrl,
  qcfLocalFontUrl,
  SURAH_NAME_FONT_URL,
  TOTAL_MUSHAF_FONT_PAGES,
} from '@/lib/qcf-font-cdn'

/** Must match `public/sw.js` QCF_FONT_CACHE and download script cache keys. */
export const QCF_FONT_CACHE_NAME = 'muyassar-qcf-fonts-v2'
const CACHE_NAME = QCF_FONT_CACHE_NAME
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

async function qcfFontInCache(page: number): Promise<boolean> {
  if (typeof caches === 'undefined') return false
  try {
    const cache = await caches.open(CACHE_NAME)
    const local = qcfLocalFontUrl(page)
    if (await cache.match(local)) return true
    return Boolean(await cache.match(qcfLegacyLocalFontUrl(page)))
  } catch {
    return false
  }
}

/**
 * Font URL for @font-face / FontFace.
 * Offline: same-origin `/qcf/p{n}.woff2` (service worker serves Cache API bytes).
 * Online: Quran Foundation CDN. Never probes missing `public/qcf` files (avoids 404 spam).
 */
export async function resolveQcfFontUrl(page: number): Promise<string> {
  if (page < 1 || page > TOTAL_MUSHAF_FONT_PAGES) return qcfCdnFontUrl(page)

  if (await qcfFontInCache(page)) {
    return qcfLocalFontUrl(page)
  }

  return qcfCdnFontUrl(page)
}

/** URLs to try in order: offline SW path (if cached), then CDN. */
export async function resolveQcfFontUrlsForLoad(page: number): Promise<string[]> {
  const cdn = qcfCdnFontUrl(page)
  const urls: string[] = []

  if (await qcfFontInCache(page)) {
    urls.push(qcfLocalFontUrl(page))
  }

  if (!urls.includes(cdn)) urls.push(cdn)
  return urls
}

export async function resolveSurahNameFontUrl(): Promise<string> {
  if (typeof caches !== 'undefined') {
    try {
      const cache = await caches.open(CACHE_NAME)
      const hit = await cache.match(SURAH_CACHE_KEY)
      if (hit) return SURAH_CACHE_KEY
    } catch {
      /* ignore */
    }
  }

  const local = '/fonts/surah-name-v2.ttf'
  try {
    const head = await fetch(local, { method: 'HEAD' })
    if (head.ok) return local
  } catch {
    /* ignore */
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

    const response = await fetch(requestUrl, { mode: 'cors', cache: 'no-cache' })
    if (!response.ok) return false
    await cache.put(cacheKey, response.clone())
    return true
  } catch {
    return false
  }
}

export async function verifyMushafFontsCached(): Promise<boolean> {
  return qcfFontInCache(1)
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
  let saved = 0

  async function worker(): Promise<void> {
    while (nextPage <= TOTAL_MUSHAF_FONT_PAGES) {
      const page = nextPage
      nextPage += 1

      const localKey = qcfLocalFontUrl(page)
      const ok = await cacheFont(cache, qcfCdnFontUrl(page), localKey)
      if (ok) saved += 1

      done += 1
      report()
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()))

  if (saved < 500) {
    clearOfflineFontsCachedFlag()
    throw new Error(
      `Only ${saved} of ${TOTAL_MUSHAF_FONT_PAGES} mushaf fonts saved. Stay on Wi‑Fi and try again.`
    )
  }

  markOfflineFontsCached()
  onProgress?.({ done: total, total, percent: 100 })
}
