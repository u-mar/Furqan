import {
  qcfCdnFontUrl,
  qcfLegacyLocalFontUrl,
  qcfLocalFontUrl,
  TOTAL_MUSHAF_FONT_PAGES,
} from '@/lib/qcf-font-cdn'
import { tr } from '@/lib/i18n-core'
import { hasBundledQuran } from '@/lib/native-app'

/**
 * Must match `public/sw.js` QCF_FONT_CACHE. Named for the V4 fonts: the V2 ones saved before
 * (muyassar-qcf-fonts-v2) are replaced by upgradeSavedMushafFonts.
 */
export const QCF_FONT_CACHE_NAME = 'naba-qcf-fonts-v4'
const OLD_QCF_FONT_CACHE_NAME = 'muyassar-qcf-fonts-v2'
const SAVED_FLAG = 'naba_qcf_v4_saved'
const OLD_SAVED_FLAG = 'muyassar_fonts_cached'
const CACHE_NAME = QCF_FONT_CACHE_NAME
const SURAH_CACHE_KEY = '/fonts/surah-header-color.woff2'

export function areOfflineFontsCached(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(SAVED_FLAG) === '1'
  } catch {
    return false
  }
}

export function markOfflineFontsCached(): void {
  try {
    localStorage.setItem(SAVED_FLAG, '1')
  } catch {
    /* ignore */
  }
}

export function clearOfflineFontsCachedFlag(): void {
  try {
    localStorage.removeItem(SAVED_FLAG)
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
function isOfflineBrowser(): boolean {
  return typeof navigator !== 'undefined' && !navigator.onLine
}

export async function resolveQcfFontUrl(page: number): Promise<string> {
  if (page < 1 || page > TOTAL_MUSHAF_FONT_PAGES) return qcfCdnFontUrl(page)
  // The Play Store app has every page's font inside it.
  if (hasBundledQuran()) return qcfLocalFontUrl(page)

  if (areOfflineFontsCached() || isOfflineBrowser() || (await qcfFontInCache(page))) {
    return qcfLocalFontUrl(page)
  }

  return qcfCdnFontUrl(page)
}

/** A development server: it has the fonts in public/qcf, and Naba's storage serves only qurannaba.com. */
function isDevHost(): boolean {
  if (typeof window === 'undefined') return false
  const host = window.location.hostname
  return host === 'localhost' || host === '127.0.0.1' || host.endsWith('.localhost')
}

/** URLs to try in order: local/SW paths when offline or fonts were downloaded, then CDN when online. */
export async function resolveQcfFontUrlsForLoad(page: number): Promise<string[]> {
  if ((hasBundledQuran() || isDevHost()) && page >= 1 && page <= TOTAL_MUSHAF_FONT_PAGES) {
    return [qcfLocalFontUrl(page)]
  }
  const cdn = qcfCdnFontUrl(page)
  const local = qcfLocalFontUrl(page)
  const legacy = qcfLegacyLocalFontUrl(page)
  const urls: string[] = []
  const offline = isOfflineBrowser()
  const fontsCached = areOfflineFontsCached()
  const inCache = await qcfFontInCache(page)

  if (fontsCached || offline || inCache) {
    urls.push(local)
    if (legacy !== local) urls.push(legacy)
  }

  if (!offline) {
    if (!urls.includes(cdn)) urls.push(cdn)
  }

  return urls.length > 0 ? urls : [cdn]
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
    throw new Error(tr('Font caching is not supported in this browser.'))
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

  // The app's own compressed copy (119 KB), not the 1.8 MB original.
  await cacheFont(cache, SURAH_CACHE_KEY, SURAH_CACHE_KEY)
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
      tr('Only {saved} of {total} mushaf fonts saved. Stay on Wi‑Fi and try again.', { saved, total: TOTAL_MUSHAF_FONT_PAGES })
    )
  }

  markOfflineFontsCached()
  onProgress?.({ done: total, total, percent: 100 })
}

/**
 * Someone who saved the mushaf for offline before the V4 fonts has the V2 ones saved: once online,
 * the V4 fonts are saved in their place, quietly, and the V2 ones then let go. Until then the
 * service worker still answers from the V2 copy when offline.
 */
let upgrading = false
export async function upgradeSavedMushafFonts(): Promise<void> {
  if (upgrading || typeof window === 'undefined' || typeof caches === 'undefined') return
  if (hasBundledQuran() || !navigator.onLine) return
  try {
    if (localStorage.getItem(OLD_SAVED_FLAG) !== '1' || areOfflineFontsCached()) return
  } catch {
    return
  }
  upgrading = true
  try {
    await cacheAllMushafFonts()
    if (await verifyMushafFontsCached()) {
      markOfflineFontsCached()
      localStorage.removeItem(OLD_SAVED_FLAG)
      await caches.delete(OLD_QCF_FONT_CACHE_NAME)
    }
  } catch {
    // Tried again on a later launch.
  } finally {
    upgrading = false
  }
}
