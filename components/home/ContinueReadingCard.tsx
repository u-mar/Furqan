'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { LAST_READ_PAGE_KEY, LAST_READ_POSITION_KEY } from '@/lib/mushaf'
import { tr, useLanguage, useT } from '@/lib/i18n'

interface ContinueState {
  surahName: string
  /** The surah's name in Arabic, when the chapter list could be read. */
  arabicName: string
  page: number
}

interface ChapterRow {
  id: number
  name_simple: string
  name_arabic: string
  pages: [number, number]
}

/** The page last read, and the ayah the reader recorded on it, if any. */
function readPosition(): { page: number; verseKey: string | null } {
  const page = Math.min(604, Math.max(1, Number(localStorage.getItem(LAST_READ_PAGE_KEY) || '1') || 1))
  try {
    const raw = localStorage.getItem(LAST_READ_POSITION_KEY)
    const saved = raw ? (JSON.parse(raw) as { page?: number; verseKey?: string }) : null
    if (saved?.page === page && /^\d+:\d+$/.test(saved.verseKey ?? '')) return { page, verseKey: saved.verseKey ?? null }
  } catch {
    // Fall back to naming the surah from the page alone.
  }
  return { page, verseKey: null }
}

export default function ContinueReadingCard() {
  const t = useT()
  const language = useLanguage()
  const [state, setState] = useState<ContinueState | null>(null)

  /* Naming the place needs only the small chapter list. */
  useEffect(() => {
    let cancelled = false
    const where = readPosition()
    const { page } = where
    const surah = where.verseKey ? Number(where.verseKey.split(':')[0]) : null

    fetch('/quran-chapters.json', { cache: 'force-cache' })
      .then((res) => (res.ok ? (res.json() as Promise<{ chapters: ChapterRow[] }>) : Promise.reject()))
      .then(({ chapters }) => {
        if (cancelled) return
        // The first surah whose pages include this one is the one at the top of it.
        const chapter = surah
          ? chapters.find((c) => c.id === surah)
          : chapters.find((c) => c.pages[0] <= page && page <= c.pages[1])
        setState({
          surahName: chapter?.name_simple ?? tr('Page {page}', { page }),
          arabicName: chapter?.name_arabic ?? '',
          page,
        })
      })
      .catch(() => {
        if (!cancelled) setState({ surahName: surah ? tr('Surah {surah}', { surah }) : tr('Continue reading'), arabicName: '', page })
      })

    return () => {
      cancelled = true
    }
  }, [])

  if (!state) return <div className="h-[3.75rem] animate-pulse rounded-full bg-[var(--home-card-bg)]" aria-hidden />

  const surah = language === 'ar' && state.arabicName ? state.arabicName : state.surahName

  // One slim rounded bar: where reading stopped, and a blue arrow to carry on.
  return (
    <Link
      href={`/read?page=${state.page}`}
      className="home-press ed-focus flex items-center gap-3 rounded-full bg-[var(--home-card-bg)] py-2 pe-2 ps-5"
      aria-label={t('Continue reading {surahName}, page {page}', { surahName: state.surahName, page: state.page })}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[0.78125rem] text-[var(--home-muted)]">{t('Continue reading')}</span>
        <span className="block truncate text-[1rem] font-semibold text-[var(--home-heading)]">
          {surah} · {t('Page')} {state.page}
        </span>
      </span>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--home-sage-deep)] text-white" aria-hidden>
        <ArrowRight className="h-5 w-5 rtl:-scale-x-100" strokeWidth={2.4} />
      </span>
    </Link>
  )
}
