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
            Ayah {state.ayah} · Page {state.page} of 604
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
