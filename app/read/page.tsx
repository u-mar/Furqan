'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import QuranPageView from '@/components/QuranPageView'
import ThemeToggle from '@/components/ThemeToggle'
import Button from '@/components/ui/Button'
import {
  getChapters,
  getMushafPage,
  getVersesByChapter,
  getVersesByJuz,
  getVisualPagesForScope,
} from '@/lib/quran'
import type { Chapter, ScopeMode, Verse } from '@/types'

const TOTAL_PAGES = 604

function ReadPageContent() {
  const searchParams = useSearchParams()
  const mode = (searchParams.get('mode') || 'surah') as ScopeMode
  const surah = Number(searchParams.get('surah') || '1')
  const juz = Number(searchParams.get('juz') || '1')

  const [chapters, setChapters] = useState<Chapter[]>([])
  const [pageVerses, setPageVerses] = useState<Verse[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getChapters().then(setChapters).catch(() => {})
  }, [])

  useEffect(() => {
    async function loadScope() {
      setLoading(true)
      try {
        const [verses, visualPageMap] = await Promise.all([
          mode === 'juz' ? getVersesByJuz(juz) : getVersesByChapter(surah),
          mode === 'juz' ? getVisualPagesForScope({ juz }) : getVisualPagesForScope({ chapter: surah }),
        ])
        if (verses.length === 0) throw new Error('No verses found')

        const startPage = Math.min(
          ...verses.map((v) => visualPageMap[v.verse_key] || v.page_number || 1)
        )

        const firstPageVerses = await getMushafPage(startPage)
        setCurrentPage(startPage)
        setPageVerses(firstPageVerses)
      } catch (err) {
        console.error('Failed to load scope:', err)
      } finally {
        setLoading(false)
      }
    }
    loadScope()
  }, [mode, surah, juz])

  const loadPage = async (page: number) => {
    try {
      const verses = await getMushafPage(page)
      setPageVerses(verses)
      setCurrentPage(page)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      console.error('Failed to load page:', err)
    }
  }

  const pageVerseKeys = useMemo(() => new Set(pageVerses.map((v) => v.verse_key)), [pageVerses])
  const startVerseKey = pageVerses[0]?.verse_key || ''
  const currentSurahNum = Number(startVerseKey.split(':')[0] || 1)
  const surahTitle =
    chapters.find((c) => c.id === currentSurahNum)?.englishName || `Surah ${currentSurahNum}`

  const testHref =
    mode === 'surah' ? `/test?mode=surah&surah=${surah}` : `/test?mode=juz&juz=${juz}`

  if (loading) {
    return (
      <main className="min-h-screen bg-[var(--hifdh-bg)]">
        <div className="mx-auto flex max-w-lg flex-col items-center justify-center px-4 py-24">
          <div
            className="mb-4 h-8 w-8 rounded-full border-2 border-stone-200 border-t-teal-700 motion-safe:animate-spin"
            role="status"
            aria-label="Loading"
          />
          <p className="text-sm text-[var(--hifdh-muted)]">Loading…</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[var(--hifdh-bg)] text-[var(--hifdh-text)]">
      <header className="sticky top-0 z-20 border-b border-[var(--hifdh-border)] bg-[var(--hifdh-bg)]/90 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-serif text-lg font-medium leading-tight text-[var(--hifdh-text)]">
              {surahTitle}
            </p>
            <p className="text-[11px] text-[var(--hifdh-muted)]">Page {currentPage}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <ThemeToggle />
            <Link
              href={testHref}
              className="rounded-full px-3 py-2 text-xs font-medium text-teal-700 transition-colors hover:bg-teal-50 dark:text-teal-400 dark:hover:bg-teal-900/20"
            >
              Test
            </Link>
            <Link
              href="/"
              className="rounded-full px-3 py-2 text-xs text-[var(--hifdh-muted)] transition-colors hover:bg-stone-100 hover:text-stone-900 dark:hover:bg-stone-800 dark:hover:text-stone-100"
            >
              Back
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full px-3 pb-12 pt-4 sm:px-5">
        <div className="mb-5">
          <QuranPageView
            verses={pageVerses}
            startVerseKey={startVerseKey}
            revealableVerseKeys={pageVerseKeys}
            revealedAyahs={pageVerseKeys}
            onReveal={() => {}}
          />
        </div>

        <div className="mx-auto mb-4 flex max-w-3xl items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => currentPage < TOTAL_PAGES && loadPage(currentPage + 1)}
            disabled={currentPage >= TOTAL_PAGES}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => currentPage > 1 && loadPage(currentPage - 1)}
            disabled={currentPage <= 1}
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </div>
    </main>
  )
}

export default function ReadPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[var(--hifdh-bg)]">
          <div className="mx-auto flex max-w-lg flex-col items-center justify-center px-4 py-24">
            <div className="mb-4 h-8 w-8 rounded-full border-2 border-stone-200 border-t-teal-700 motion-safe:animate-spin" />
            <p className="text-sm text-stone-500">Loading…</p>
          </div>
        </main>
      }
    >
      <ReadPageContent />
    </Suspense>
  )
}
