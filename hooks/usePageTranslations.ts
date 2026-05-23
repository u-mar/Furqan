'use client'

import { useEffect, useState } from 'react'

export interface TranslationRow {
  verse_key: string
  text_uthmani: string
  translation: string
}

export function usePageTranslations(
  page: number,
  enabled: boolean,
  verseKeys: string[],
  arabicByKey: Record<string, string>
) {
  const [rows, setRows] = useState<TranslationRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!enabled || page < 1) {
      setRows([])
      return
    }

    setLoading(true)
    fetch(`/api/ayah?type=translations&page=${page}`)
      .then((r) => r.json())
      .then((data) => {
        if (!Array.isArray(data)) {
          setRows([])
          return
        }
        const onPage = new Set(verseKeys)
        const order = new Map(verseKeys.map((k, i) => [k, i]))
        const filtered = data
          .filter((r: TranslationRow) => onPage.has(r.verse_key))
          .map((r: TranslationRow) => ({
            ...r,
            text_uthmani: r.text_uthmani || arabicByKey[r.verse_key] || '',
          }))
          .sort(
            (a: TranslationRow, b: TranslationRow) =>
              (order.get(a.verse_key) ?? 0) - (order.get(b.verse_key) ?? 0)
          )
        setRows(filtered)
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [page, enabled, verseKeys.join(','), JSON.stringify(arabicByKey)])

  const byKey = Object.fromEntries(rows.map((r) => [r.verse_key, r]))

  return { rows, byKey, loading }
}
