import { TOTAL_MUSHAF_PAGES } from '@/lib/mushaf'
import { getTranslationLanguage, type TranslationLanguageId } from '@/lib/translations'

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

function flagKey(lang: TranslationLanguageId): string {
  return `muyassar_translations_cached_${lang}`
}

function cacheKey(lang: TranslationLanguageId, page: number): string {
  return `/offline/translations/${lang}/p${page}.json`
}

function migrateLegacyTranslationFlag(): void {
  try {
    if (localStorage.getItem('muyassar_translations_cached') !== '1') return
    localStorage.setItem(flagKey('en'), '1')
    localStorage.setItem(flagKey('so'), '1')
    localStorage.removeItem('muyassar_translations_cached')
  } catch {
    /* ignore */
  }
}

export function areTranslationsCached(lang: TranslationLanguageId): boolean {
  if (typeof window === 'undefined') return false
  migrateLegacyTranslationFlag()
  try {
    return localStorage.getItem(flagKey(lang)) === '1'
  } catch {
    return false
  }
}

export function clearTranslationsCachedFlag(lang: TranslationLanguageId): void {
  try {
    localStorage.removeItem(flagKey(lang))
  } catch {
    /* ignore */
  }
}

export async function getOfflineTranslations(
  page: number,
  lang: TranslationLanguageId
): Promise<TranslationRow[] | null> {
  if (typeof caches === 'undefined' || page < 1) return null
  try {
    const cache = await caches.open(CACHE_NAME)
    const hit = await cache.match(cacheKey(lang, page))
    if (!hit) return null
    const data = (await hit.json()) as unknown
    return Array.isArray(data) ? (data as TranslationRow[]) : null
  } catch {
    return null
  }
}

/** Download one translation language for all mushaf pages (offline read mode). */
export async function downloadOfflineTranslations(
  lang: TranslationLanguageId,
  onProgress?: (p: TranslationDownloadProgress) => void
): Promise<void> {
  if (typeof caches === 'undefined') {
    throw new Error('Translation caching is not supported in this browser.')
  }

  const { label } = getTranslationLanguage(lang)
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

  report(`${label} · starting…`)

  for (let page = 1; page <= TOTAL_MUSHAF_PAGES; page += 1) {
    const key = cacheKey(lang, page)
    try {
      const existing = await cache.match(key)
      if (existing) {
        saved += 1
      } else {
        const response = await fetch(
          `/api/ayah?type=translations&page=${page}&lang=${lang}`,
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
    report(`${label} · page ${page}/${TOTAL_MUSHAF_PAGES}`)
  }

  if (saved < total * 0.85) {
    clearTranslationsCachedFlag(lang)
    throw new Error(
      `Only ${saved} of ${total} pages saved for ${label}. Stay on Wi‑Fi and try again.`
    )
  }

  try {
    localStorage.setItem(flagKey(lang), '1')
  } catch {
    /* ignore */
  }

  onProgress?.({ done: total, total, percent: 100, label: `${label} ready offline` })
}
