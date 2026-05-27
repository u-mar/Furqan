'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { LAST_READ_PAGE_KEY } from '@/lib/mushaf'
import { getChapters, getMushafPage } from '@/lib/quran'
import { IconRead } from '@/components/home/TileIcons'

interface ContinueState {
  surahName: string
  ayah: number
  page: number
  progress: number
}

export default function ContinueReadingCard() {
  const [state, setState] = useState<ContinueState | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    void (async () => {
      const savedPage = Number(localStorage.getItem(LAST_READ_PAGE_KEY) || '1') || 1
      try {
        const [chapters, verses] = await Promise.all([
          getChapters(),
          getMushafPage(savedPage),
        ])
        if (cancelled || verses.length === 0) return

        const first = verses[0]
        const surahId = Number(first.verse_key.split(':')[0]) || 1
        const ayah = Number(first.verse_key.split(':')[1]) || 1
        const surahName = chapters.find((c) => c.id === surahId)?.englishName || `Surah ${surahId}`
        const progress = Math.min(100, Math.round((savedPage / 604) * 100))

        setState({
          surahName,
          ayah,
          page: savedPage,
          progress: Math.max(progress, 1),
        })
      } catch {
        if (!cancelled) setState(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <section className="mb-8" aria-label="Continue reading">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="home-serif text-lg font-semibold text-[var(--home-heading)]">
            Continue Reading
          </h2>
        </div>
        <div className="h-[88px] animate-pulse rounded-2xl bg-white/60" />
      </section>
    )
  }

  if (!state) return null

  return (
    <section className="mb-8" aria-label="Continue reading">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="home-serif text-lg font-semibold text-[var(--home-heading)]">
          Continue Reading
        </h2>
        <Link
          href="/read"
          className="text-sm font-medium text-[var(--home-muted)] transition-colors hover:text-[var(--home-heading)]"
        >
          View History
        </Link>
      </div>

      <Link
        href={`/read?page=${state.page}`}
        className="flex items-center gap-4 rounded-2xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] p-4 shadow-[var(--home-card-shadow)] transition-transform active:scale-[0.99]"
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--home-sage)]/15 text-[var(--home-sage-dark)]">
          <IconRead className="h-7 w-7" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-[var(--home-heading)]">{state.surahName}</span>
          <span className="mt-0.5 block text-sm text-[var(--home-muted)]">
            Ayah {state.ayah} · Page {state.page}
          </span>
          <span className="mt-3 block h-1.5 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-700">
            <span
              className="block h-full rounded-full bg-[var(--home-sage)]"
              style={{ width: `${state.progress}%` }}
            />
          </span>
        </span>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--home-card-border)] text-[var(--home-sage-dark)]">
          <ChevronRight className="h-5 w-5" strokeWidth={1.75} />
        </span>
      </Link>
    </section>
  )
}
