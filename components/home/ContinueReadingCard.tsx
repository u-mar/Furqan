'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { getLocalMushafPage, hydrateOfflineFromDisk, isOfflineReady } from '@/lib/local-quran-store'
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
        let verses = isOfflineReady() ? getLocalMushafPage(savedPage) || [] : []
        if (verses.length === 0) {
          try {
            await hydrateOfflineFromDisk()
            verses = getLocalMushafPage(savedPage) || []
          } catch {
            // fall back to network fetch below
          }
        }

        if (verses.length === 0) {
          verses = await getMushafPage(savedPage)
        }

        const chapters = await getChapters().catch(() => [])
        if (cancelled || verses.length === 0) return

        const first = verses[0]
        const surahId = Number(first.verse_key.split(':')[0]) || 1
        const ayah = Number(first.verse_key.split(':')[1]) || 1
        const surahName =
          chapters.find((c) => c.id === surahId)?.englishName || `Surah ${surahId}`
        const progress = Math.min(100, Math.round((savedPage / 604) * 100))

        setState({
          surahName,
          ayah,
          page: savedPage,
          progress: Math.max(progress, 1),
        })
      } catch {
        if (!cancelled) {
          // Keep continue reading available even when offline data is not ready yet.
          setState({
            surahName: 'Continue reading',
            ayah: 1,
            page: savedPage,
            progress: Math.max(1, Math.min(100, Math.round((savedPage / 604) * 100))),
          })
        }
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
      <section className="mb-9" aria-label="Continue reading">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="ed-label">Continue reading</h2>
        </div>
        <div className="h-[92px] animate-pulse rounded-[1.25rem] bg-[var(--home-track)]" />
      </section>
    )
  }

  if (!state) return null

  return (
    <section className="mb-9" aria-label="Continue reading">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="ed-label">Continue reading</h2>
      </div>

      <Link
        href={`/read?page=${state.page}`}
        className="ed-card ed-focus group flex items-center gap-4 rounded-[1.25rem] p-4 transition-[border-color,transform] duration-200 hover:border-[var(--home-sage)] active:scale-[0.99]"
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--home-sage-soft)] text-[var(--home-sage-deep)]">
          <IconRead className="h-6 w-6" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="home-serif block truncate text-[1.15rem] font-medium leading-tight text-[var(--home-heading)]">
            {state.surahName}
          </span>
          <span className="mt-0.5 block text-xs text-[var(--home-muted)]">
            Ayah <span className="ed-num text-[var(--home-heading)]">{state.ayah}</span> · Page{' '}
            <span className="ed-num text-[var(--home-heading)]">{state.page}</span> of 604
          </span>
          <span className="mt-3 flex items-center gap-2.5">
            <span className="block h-1 flex-1 overflow-hidden rounded-full bg-[var(--home-track)]">
              <span
                className="block h-full rounded-full bg-[var(--home-sage)]"
                style={{ width: `${state.progress}%` }}
              />
            </span>
            <span className="ed-num text-[0.7rem] font-semibold text-[var(--home-sage-deep)]">
              {state.progress}%
            </span>
          </span>
        </span>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--home-rule-strong)] text-[var(--home-heading)] transition-colors group-hover:bg-[var(--home-ink)] group-hover:text-[var(--home-ink-fg)]">
          <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
        </span>
      </Link>
    </section>
  )
}
