'use client'

import { useEffect, useState } from 'react'

export interface TranslationRow {
  verse_key: string
  text_uthmani: string
  translation: string
}

import { getOfflineTranslations } from '@/lib/offline-translations'
import type { TranslationLanguageId } from '@/lib/translations'

export function usePageTranslations(
  page: number,
  enabled: boolean,
  verseKeys: string[],
  arabicByKey: Record<string, string>,
  translationLanguage: TranslationLanguageId = 'en'
) {
  const [rows, setRows] = useState<TranslationRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!enabled || page < 1) {
      setRows([])
      return
    }

    const cacheKey = `translations:v1:${translationLanguage}:page:${page}`
    const onPage = new Set(verseKeys)
    const order = new Map(verseKeys.map((k, i) => [k, i]))

    const normalizeRows = (data: TranslationRow[]): TranslationRow[] =>
      data
        .filter((r) => onPage.has(r.verse_key))
        .map((r) => ({
          ...r,
          text_uthmani: r.text_uthmani || arabicByKey[r.verse_key] || '',
        }))
        .sort((a, b) => (order.get(a.verse_key) ?? 0) - (order.get(b.verse_key) ?? 0))

    const readCache = (): TranslationRow[] => {
      if (typeof window === 'undefined') return []
      try {
        const raw = localStorage.getItem(cacheKey)
        if (!raw) return []
        const parsed = JSON.parse(raw) as TranslationRow[]
        return Array.isArray(parsed) ? normalizeRows(parsed) : []
      } catch {
        return []
      }
    }

    const writeCache = (next: TranslationRow[]): void => {
      if (typeof window === 'undefined') return
      try {
        localStorage.setItem(cacheKey, JSON.stringify(next))
      } catch {
        // Ignore quota errors; network/source of truth still works.
      }
    }

    let cancelled = false
    const cachedRows = readCache()
    if (cachedRows.length > 0) setRows(cachedRows)

    setLoading(true)
    void (async () => {
      try {
        const offlineRows = await getOfflineTranslations(page, translationLanguage)
        if (offlineRows && offlineRows.length > 0) {
          const normalized = normalizeRows(offlineRows)
          if (!cancelled) setRows(normalized)
          if (normalized.length > 0) writeCache(normalized)
          return
        }

        const response = await fetch(`/api/ayah?type=translations&page=${page}&lang=${translationLanguage}`)
        const data = (await response.json()) as unknown
        if (!Array.isArray(data)) {
          if (!cancelled && cachedRows.length === 0) setRows([])
          return
        }
        const normalized = normalizeRows(data as TranslationRow[])
        if (!cancelled) setRows(normalized)
        if (normalized.length > 0) writeCache(normalized)
      } catch {
        if (!cancelled && cachedRows.length === 0) setRows([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [page, enabled, translationLanguage, verseKeys.join(','), JSON.stringify(arabicByKey)])

  const byKey = Object.fromEntries(rows.map((r) => [r.verse_key, r]))

  return { rows, byKey, loading }
}
