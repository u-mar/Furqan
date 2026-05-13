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
import { cn } from '@/lib/cn'
import type { Chapter, ScopeMode, Verse } from '@/types'

type ViewMode = 'page' | 'scroll'

function ReadPageContent() {
  const searchParams = useSearchParams()
  const mode = (searchParams.get('mode') || 'surah') as ScopeMode
  const surah = Number(searchParams.get('surah') || '1')
  const juz = Number(searchParams.get('juz') || '1')

  const [chapters, setChapters] = useState<Chapter[]>([])
  const [allVerses, setAllVerses] = useState<Verse[]>([])
  const [pageVerses, setPageVerses] = useState<Verse[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [scopePages, setScopePages] = useState<number[]>([])
  const [viewMode, setViewMode] = useState<ViewMode>('page')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getChapters().then(setChapters).catch(() => {})
  }, [])

  useEffect(() => {
    async function loadScope() {
      setLoading(true)
      try {
        let verses: Verse[] = []
        if (mode === 'surah') {
          verses = await getVersesByChapter(surah)
        } else if (mode === 'juz') {
          verses = await getVersesByJuz(juz)
        }
        if (verses.length === 0) throw new Error('No verses found')

        const visualPageMap =
          mode === 'juz'
            ? await getVisualPagesForScope({ juz })
            : await getVisualPagesForScope({ chapter: surah })

        const allPages = Array.from(
          new Set(verses.map((v) => visualPageMap[v.verse_key] || v.page_number || 1))
        ).sort((a, b) => a - b)

        const firstPage = allPages[0] || 1
        const firstPageVerses = await getMushafPage(firstPage)

        setAllVerses(verses)
        setScopePages(allPages)
        setCurrentPage(firstPage)
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

  const currentPageIndex = scopePages.indexOf(currentPage)
  const hasPrev = currentPageIndex > 0
  const hasNext = currentPageIndex < scopePages.length - 1

  // In reading mode all page text is visible — pass pageVerses as both revealable and revealed
  const pageVerseKeys = useMemo(() => new Set(pageVerses.map((v) => v.verse_key)), [pageVerses])
  const startVerseKey = pageVerses[0]?.verse_key || ''

  const scopeLabel = mode === 'surah' ? `Surah ${surah}` : `Juz ${juz}`
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
            <p className="text-[11px] text-[var(--hifdh-muted)]">
              {scopeLabel}
              {viewMode === 'page' && ` · Page ${currentPage}`}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <div className="mr-1 flex gap-0.5 rounded-full bg-stone-200 p-0.5 dark:bg-stone-800">
              {(['page', 'scroll'] as ViewMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setViewMode(m)}
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                    viewMode === m
                      ? 'bg-white text-stone-900 shadow-sm dark:bg-stone-700 dark:text-stone-100'
                      : 'text-stone-500 dark:text-stone-400'
                  )}
                >
                  {m === 'page' ? 'Page' : 'Scroll'}
                </button>
              ))}
            </div>
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
        {viewMode === 'page' ? (
          <>
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
                onClick={() => hasNext && loadPage(scopePages[currentPageIndex + 1])}
                disabled={!hasNext}
              >
                <ChevronRight className="h-4 w-4" aria-hidden />
                Next page
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => hasPrev && loadPage(scopePages[currentPageIndex - 1])}
                disabled={!hasPrev}
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
                Previous page
              </Button>
            </div>
          </>
        ) : (
          <ScrollView verses={allVerses} chapters={chapters} />
        )}
      </div>
    </main>
  )
}

function ScrollView({ verses, chapters }: { verses: Verse[]; chapters: Chapter[] }) {
  const surahGroups = useMemo(() => {
    const map = new Map<number, { chapter: Chapter | undefined; verses: Verse[] }>()
    for (const v of verses) {
      const surahNum = Number(v.verse_key.split(':')[0])
      if (!map.has(surahNum)) {
        map.set(surahNum, { chapter: chapters.find((c) => c.id === surahNum), verses: [] })
      }
      map.get(surahNum)!.verses.push(v)
    }
    return Array.from(map.entries()).sort(([a], [b]) => a - b)
  }, [verses, chapters])

  return (
    <div className="mx-auto max-w-3xl py-4">
      {surahGroups.map(([surahNum, { chapter, verses: surahVerses }]) => (
        <div key={surahNum} className="mb-16">
          <div className="mb-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-stone-200 dark:bg-stone-800" aria-hidden />
            <div className="text-center">
              <p className="amiri text-2xl font-bold text-stone-800 dark:text-stone-200">
                {chapter?.name || `سورة ${surahNum}`}
              </p>
              <p className="mt-0.5 text-[11px] uppercase tracking-wider text-stone-500 dark:text-stone-400">
                {chapter?.englishName || `Surah ${surahNum}`}
              </p>
            </div>
            <span className="h-px flex-1 bg-stone-200 dark:bg-stone-800" aria-hidden />
          </div>

          <p
            className="arabic-text text-right text-stone-900 dark:text-stone-100"
            dir="rtl"
            lang="ar"
          >
            {surahVerses.map((verse) => {
              const ayahNum = Number(verse.verse_key.split(':')[1])
              return (
                <span key={verse.verse_key}>
                  {verse.text_uthmani}
                  {' '}
                  <span
                    aria-label={`Verse ${ayahNum}`}
                    className="inline-flex h-[1.15em] min-w-[1.15em] items-center justify-center rounded-full border border-stone-300 px-1 font-sans text-[0.42em] tabular-nums text-stone-500 dark:border-stone-700 dark:text-stone-400"
                    style={{ verticalAlign: 'middle' }}
                  >
                    {ayahNum}
                  </span>
                  {' '}
                </span>
              )
            })}
          </p>
        </div>
      ))}
    </div>
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
