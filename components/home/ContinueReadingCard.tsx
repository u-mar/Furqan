'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { LAST_READ_PAGE_KEY, LAST_READ_POSITION_KEY } from '@/lib/mushaf'
import { tr, useT } from '@/lib/i18n'

interface ContinueState {
  surahName: string
  /** The surah's name in Arabic, when the chapter list could be read. */
  arabicName: string
  /** Unknown until the reader has saved a position on this page. */
  ayah: number | null
  page: number
  progress: number
}

interface ChapterRow {
  id: number
  name_simple: string
  name_arabic: string
  pages: [number, number]
}

/** The page last read, and the first ayah on it when the reader recorded one. */
function readPosition(): { page: number; surah: number | null; ayah: number | null } {
  const page = Math.min(604, Math.max(1, Number(localStorage.getItem(LAST_READ_PAGE_KEY) || '1') || 1))
  try {
    const raw = localStorage.getItem(LAST_READ_POSITION_KEY)
    const saved = raw ? (JSON.parse(raw) as { page?: number; verseKey?: string }) : null
    const match = saved?.page === page ? /^(\d+):(\d+)$/.exec(saved.verseKey ?? '') : null
    if (match) return { page, surah: Number(match[1]), ayah: Number(match[2]) }
  } catch {
    // Fall back to naming the surah from the page alone.
  }
  return { page, surah: null, ayah: null }
}

export default function ContinueReadingCard() {
  const t = useT()
  const [state, setState] = useState<ContinueState | null>(null)
  const [loading, setLoading] = useState(true)

  /* Naming the place needs only the small chapter list. This used to load and
     parse the whole Quran to read one ayah number, which froze the home
     screen for a couple of seconds on every visit. */
  useEffect(() => {
    let cancelled = false
    const { page, surah, ayah } = readPosition()
    const progress = Math.max(1, Math.min(100, Math.round((page / 604) * 100)))

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
          ayah,
          page,
          progress,
        })
      })
      .catch(() => {
        if (!cancelled) {
          setState({
            surahName: surah ? tr('Surah {surah}', { surah }) : tr('Continue reading'),
            arabicName: '',
            ayah,
            page,
            progress,
          })
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <section aria-label={t('Continue reading')}>
        <div className="home-v2-card h-[4.375rem] animate-pulse rounded-[1.125rem]" />
      </section>
    )
  }

  if (!state) return null

  return (
    <section aria-label={t('Continue reading')}>
      <Link
        href={`/read?page=${state.page}`}
        className="home-v2-card home-press ed-focus flex items-center gap-3 rounded-[1.125rem] p-2.5"
        aria-label={t('Continue reading {surahName}, page {page}', { surahName: state.surahName, page: state.page })}
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[0.875rem] border border-[var(--hv-teal-line)] bg-[image:var(--hv-teal-wash)]">
          <img src="/icons/read.png" alt="" className="h-[1.875rem] w-[1.875rem] object-contain" draggable={false} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-baseline justify-between gap-2">
            <span className="home-serif truncate text-[1.0625rem] font-medium leading-tight tracking-[-0.015em]">{state.surahName}</span>
            {state.arabicName ? (
              <span lang="ar" dir="rtl" className="amiri shrink-0 text-[0.9375rem] leading-tight text-[var(--hv-accent-gold)]">
                {state.arabicName}
              </span>
            ) : null}
          </span>
          <span className="mt-0.5 text-[0.71875rem] tabular-nums text-[var(--hv-text2)]">
            {state.ayah ? t('Ayah {ayah} · ', { ayah: state.ayah }) : ''}{t('Page')} {state.page} {t('of 604')}
          </span>
          <span aria-hidden className="mt-1.5 block h-[3px] overflow-hidden rounded-full bg-[var(--hv-track)]">
            <span className="block h-full min-w-2 rounded-full bg-[var(--hv-teal)]" style={{ width: `${state.progress}%` }} />
          </span>
        </span>
        <span
          aria-hidden
          className="flex h-[2.375rem] w-[2.375rem] shrink-0 items-center justify-center rounded-full bg-[var(--hv-teal)] text-[var(--hv-on-teal)] shadow-[0_8px_20px_-8px_var(--hv-teal-glow)]"
        >
          <ArrowRight className="h-4 w-4 rtl:-scale-x-100" strokeWidth={2.4} />
        </span>
      </Link>
    </section>
  )
}
