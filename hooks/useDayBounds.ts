'use client'

import { useEffect, useState } from 'react'
import { getChapters, getMushafPage } from '@/lib/quran'
import { getVerseArabicText } from '@/lib/quran-display'
import type { Chapter, Verse } from '@/types'

export interface VerseBound {
  verseKey: string
  surahName: string
  ayah: number
  page: number
  arabic: string
}

export interface DayBounds {
  from: VerseBound
  to: VerseBound
}

function boundFromVerse(verse: Verse, chapters: Chapter[]): VerseBound {
  const surahId = Number(verse.verse_key.split(':')[0])
  const ayah = Number(verse.verse_key.split(':')[1])
  const surahName = chapters.find((c) => c.id === surahId)?.englishName || `Surah ${surahId}`
  return {
    verseKey: verse.verse_key,
    surahName,
    ayah,
    page: verse.page_number || 1,
    arabic: getVerseArabicText(verse, { omitEndMark: true }) || verse.text_uthmani,
  }
}

export function useDayBounds(startPage: number, endPage: number, enabled: boolean) {
  const [bounds, setBounds] = useState<DayBounds | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!enabled || startPage < 1) {
      setBounds(null)
      return
    }

    let cancelled = false
    setLoading(true)

    Promise.all([getChapters(), getMushafPage(startPage), getMushafPage(endPage)])
      .then(([chapters, startVerses, endVerses]) => {
        if (cancelled) return
        const first = startVerses[0]
        const last = endVerses[endVerses.length - 1]
        if (!first || !last) {
          setBounds(null)
          return
        }
        setBounds({
          from: boundFromVerse(first, chapters),
          to: boundFromVerse(last, chapters),
        })
      })
      .catch(() => {
        if (!cancelled) setBounds(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [startPage, endPage, enabled])

  return { bounds, loading }
}
