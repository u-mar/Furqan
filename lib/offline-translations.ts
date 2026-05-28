import { TOTAL_MUSHAF_PAGES } from '@/lib/mushaf'
import {
  TRANSLATION_LANGUAGES,
  type TranslationLanguageId,
} from '@/lib/translations'

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
const FLAG_KEY = 'muyassar_translations_cached'

function cacheKey(lang: TranslationLanguageId, page: number): string {
  return `/offline/translations/${lang}/p${page}.json`
}

export function areTranslationsCached(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(FLAG_KEY) === '1'
  } catch {
    return false
  }
}

export function clearTranslationsCachedFlag(): void {
  try {
    localStorage.removeItem(FLAG_KEY)
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

/** Download English + Somali translation text for all mushaf pages (offline read mode). */
export async function downloadOfflineTranslations(
  onProgress?: (p: TranslationDownloadProgress) => void
): Promise<void> {
  if (typeof caches === 'undefined') {
    throw new Error('Translation caching is not supported in this browser.')
  }

  const cache = await caches.open(CACHE_NAME)
  const langs = TRANSLATION_LANGUAGES
  const total = TOTAL_MUSHAF_PAGES * langs.length
  let done = 0
  let saved = 0

  const report = (label: string) => {
    onProgress?.({
      done,
      total,
      percent: total > 0 ? Math.min(99, Math.round((done / total) * 100)) : 0,
      label,
    })
  }

  report('Starting…')

  for (const lang of langs) {
    for (let page = 1; page <= TOTAL_MUSHAF_PAGES; page += 1) {
      const key = cacheKey(lang.id, page)
      try {
        const existing = await cache.match(key)
        if (existing) {
          saved += 1
        } else {
          const response = await fetch(
            `/api/ayah?type=translations&page=${page}&lang=${lang.id}`,
            { cache: 'no-cache' }
          )
          if (response.ok) {
            await cache.put(key, response.clone())
            saved += 1
          }
        }
      } catch {
        /* skip failed page; continue */
      }

      done += 1
      report(`${lang.label} · page ${page}/${TOTAL_MUSHAF_PAGES}`)
    }
  }

  if (saved < total * 0.85) {
    clearTranslationsCachedFlag()
    throw new Error(
      `Only ${saved} of ${total} translation pages saved. Stay on Wi‑Fi and try again.`
    )
  }

  try {
    localStorage.setItem(FLAG_KEY, '1')
  } catch {
    /* ignore */
  }

  onProgress?.({ done: total, total, percent: 100, label: 'Translations ready offline' })
}
