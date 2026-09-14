'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { LAST_READ_PAGE_KEY, LAST_READ_POSITION_KEY } from '@/lib/mushaf'
import { IconRead } from '@/components/home/TileIcons'

interface ContinueState {
  surahName: string
  /** Unknown until the reader has saved a position on this page. */
  ayah: number | null
  page: number
  progress: number
}

interface ChapterRow {
  id: number
  name_simple: string
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
        setState({ surahName: chapter?.name_simple ?? `Page ${page}`, ayah, page, progress })
      })
      .catch(() => {
        if (!cancelled) {
          setState({ surahName: surah ? `Surah ${surah}` : 'Continue reading', ayah, page, progress })
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
      <section aria-label="Continue reading">
        <h2 className="home-label mb-[9px]">Continue reading</h2>
        <div className="h-[70px] animate-pulse rounded-2xl bg-[var(--home-track)]" />
      </section>
    )
  }

  if (!state) return null

  return (
    <section aria-label="Continue reading">
      <h2 className="home-label mb-[9px]">Continue reading</h2>

      <Link
        href={`/read?page=${state.page}`}
        className="home-card home-press ed-focus flex items-center gap-3 rounded-2xl px-3.5 py-3"
        aria-label={`Continue reading ${state.surahName}, page ${state.page}`}
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--home-sage-soft)] text-[var(--home-sage-deep)]">
          <IconRead className="h-6 w-6" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="home-serif block truncate text-[1.03125rem] font-semibold leading-snug text-[var(--home-heading)]">
            {state.surahName}
          </span>
          <span className="mt-px block text-[0.78125rem] text-[var(--home-muted)]">
            {state.ayah ? `Ayah ${state.ayah} · ` : ''}Page {state.page} of 604
          </span>
          <span className="mt-[7px] block h-[3px] overflow-hidden rounded-sm bg-[var(--home-track)]">
            <span
              className="block h-full min-w-1 bg-[var(--home-sage)]"
              style={{ width: `${state.progress}%` }}
            />
          </span>
        </span>
        <span className="ed-ink flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full">
          <ArrowRight className="h-4 w-4" strokeWidth={2.2} />
        </span>
      </Link>
    </section>
  )
}
