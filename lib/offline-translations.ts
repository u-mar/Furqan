import { TOTAL_MUSHAF_PAGES } from '@/lib/mushaf'
import { getTranslationOption, languageForEdition } from '@/lib/translations'
import { tr } from '@/lib/i18n-core'
import { BUNDLED_TRANSLATIONS, hasBundledQuran } from '@/lib/native-app'

export interface TranslationRow {
  verse_key: string
  text_uthmani: string
  translation: string
}

export interface TranslationDownloadProgress {
  percent: number
  done: number
  total: number
  label: string
}

const CACHE_NAME = 'muyassar-translations-v1'

/**
 * Downloads used to be per language and only ever held its default translator, saved under
 * the language ("en", "so"). Those copies still belong to these two, so they stay usable.
 */
const LEGACY_LANGUAGE: Record<string, string> = { 'en.sahih': 'en', 'so.abduh': 'so' }

function flagKey(editionId: string): string {
  return `muyassar_translations_cached_${editionId}`
}

function cacheKey(editionId: string, page: number): string {
  return `/offline/translations/${editionId}/p${page}.json`
}

function legacyCacheKey(editionId: string, page: number): string | null {
  const lang = LEGACY_LANGUAGE[editionId]
  return lang ? `/offline/translations/${lang}/p${page}.json` : null
}

function migrateLegacyTranslationFlag(): void {
  try {
    if (localStorage.getItem('muyassar_translations_cached') !== '1') return
    localStorage.setItem('muyassar_translations_cached_en', '1')
    localStorage.setItem('muyassar_translations_cached_so', '1')
    localStorage.removeItem('muyassar_translations_cached')
  } catch {
    /* ignore */
  }
}

/** Whether this translator is inside the Play Store app (lib/native-app.ts): there is nothing to save. */
function isBundled(editionId: string): boolean {
  return hasBundledQuran() && BUNDLED_TRANSLATIONS.includes(editionId)
}

const bundled = new Map<string, Promise<Record<string, TranslationRow[]> | null>>()

/** A translator the app carries, every page of it (about 1 MB), read once from the app's own copy. */
function bundledPages(editionId: string): Promise<Record<string, TranslationRow[]> | null> {
  let pages = bundled.get(editionId)
  if (!pages) {
    pages = fetch(`/bundled/translations/${editionId}.json`)
      .then((res) => (res.ok ? (res.json() as Promise<Record<string, TranslationRow[]>>) : null))
      .catch(() => null)
      .then((data) => {
        // Not there after all: let the next page try again.
        if (!data) bundled.delete(editionId)
        return data
      })
    bundled.set(editionId, pages)
  }
  return pages
}

/** Whether this translator is saved on the phone for offline reading. */
export function areTranslationsCached(editionId: string): boolean {
  if (typeof window === 'undefined') return false
  if (isBundled(editionId)) return true
  migrateLegacyTranslationFlag()
  try {
    if (localStorage.getItem(flagKey(editionId)) === '1') return true
    const legacy = LEGACY_LANGUAGE[editionId]
    return legacy ? localStorage.getItem(flagKey(legacy)) === '1' : false
  } catch {
    return false
  }
}

export function clearTranslationsCachedFlag(editionId: string): void {
  try {
    localStorage.removeItem(flagKey(editionId))
  } catch {
    /* ignore */
  }
}

export async function getOfflineTranslations(page: number, editionId: string): Promise<TranslationRow[] | null> {
  if (page < 1) return null
  if (isBundled(editionId)) {
    const rows = (await bundledPages(editionId))?.[page]
    if (rows?.length) return rows
  }
  if (typeof caches === 'undefined') return null
  try {
    const cache = await caches.open(CACHE_NAME)
    const legacy = legacyCacheKey(editionId, page)
    const hit = (await cache.match(cacheKey(editionId, page))) ?? (legacy ? await cache.match(legacy) : undefined)
    if (!hit) return null
    const data = (await hit.json()) as unknown
    return Array.isArray(data) ? (data as TranslationRow[]) : null
  } catch {
    return null
  }
}

/** Download one translator for all mushaf pages (offline read mode). */
export async function downloadOfflineTranslations(
  editionId: string,
  onProgress?: (p: TranslationDownloadProgress) => void
): Promise<void> {
  if (typeof caches === 'undefined') {
    throw new Error(tr('Translation caching is not supported in this browser.'))
  }

  const label = getTranslationOption(editionId).label
  const language = languageForEdition(editionId)
  const cache = await caches.open(CACHE_NAME)
  const total = TOTAL_MUSHAF_PAGES
  let done = 0
  let saved = 0

  const report = (detail: string) => {
    onProgress?.({
      done,
      total,
      percent: total > 0 ? Math.min(99, Math.round((done / total) * 100)) : 0,
      label: detail,
    })
  }

  report(tr('{label} · starting…', { label }))

  for (let page = 1; page <= TOTAL_MUSHAF_PAGES; page += 1) {
    const key = cacheKey(editionId, page)
    try {
      const existing = await cache.match(key)
      if (existing) {
        saved += 1
      } else {
        const response = await fetch(
          `/api/ayah?type=translations&page=${page}&lang=${language}&edition=${encodeURIComponent(editionId)}`,
          { cache: 'no-cache' }
        )
        if (response.ok) {
          await cache.put(key, response.clone())
          saved += 1
        }
      }
    } catch {
      /* skip failed page */
    }

    done += 1
    report(tr('{label} · page {page}/{total}', { label, page, total: TOTAL_MUSHAF_PAGES }))
  }

  if (saved < total * 0.85) {
    clearTranslationsCachedFlag(editionId)
    throw new Error(
      tr('Only {saved} of {total} pages saved for {label}. Stay on Wi‑Fi and try again.', { saved, total, label })
    )
  }

  try {
    localStorage.setItem(flagKey(editionId), '1')
  } catch {
    /* ignore */
  }

  onProgress?.({ done: total, total, percent: 100, label: `${label} ready offline` })
}
