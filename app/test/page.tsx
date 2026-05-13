'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight, RefreshCw, WifiOff } from 'lucide-react'
import QuranPageView from '@/components/QuranPageView'
import ThemeToggle from '@/components/ThemeToggle'
import Button from '@/components/ui/Button'
import {
  getChapters,
  getMushafPage,
  getVersesByChapter,
  getVersesByJuz,
  getVisualPageForVerse,
  getVisualPagesForScope,
} from '@/lib/quran'
import type { Chapter, ScopeMode, Verse } from '@/types'

type Phase = 'idle' | 'testing'

function TestPageContent() {
  const searchParams = useSearchParams()
  const mode = (searchParams.get('mode') || 'surah') as ScopeMode
  const surah = Number(searchParams.get('surah') || '1')
  const juz = Number(searchParams.get('juz') || '1')
  const startAyah = Number(searchParams.get('startAyah') || '1')
  const endAyah = Number(searchParams.get('endAyah') || '1')

  const [chapters, setChapters] = useState<Chapter[]>([])
  const [pageVerses, setPageVerses] = useState<Verse[]>([])
  const [scopeVerseKeys, setScopeVerseKeys] = useState<Set<string>>(new Set())
  const [startVerseKey, setStartVerseKey] = useState<string>('')
  const [questionVerseKey, setQuestionVerseKey] = useState<string>('')
  const [questionPage, setQuestionPage] = useState<number>(1)
  const [revealedAyahs, setRevealedAyahs] = useState<Set<string>>(new Set())
  const [phase, setPhase] = useState<Phase>('idle')
  const [loading, setLoading] = useState(true)
  const [online, setOnline] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [scopePages, setScopePages] = useState<number[]>([])
  const [randomNonce, setRandomNonce] = useState(0)
  const [navDirection, setNavDirection] = useState<'forward' | 'backward' | null>(null)

  useEffect(() => {
    const sync = () => setOnline(typeof navigator !== 'undefined' && navigator.onLine)
    sync()
    window.addEventListener('online', sync)
    window.addEventListener('offline', sync)
    return () => {
      window.removeEventListener('online', sync)
      window.removeEventListener('offline', sync)
    }
  }, [])

  useEffect(() => {
    getChapters()
      .then(setChapters)
      .catch(() => {})
  }, [])

  const scopeLabel =
    mode === 'surah'
      ? `Surah ${surah}`
      : mode === 'juz'
        ? `Juz ${juz}`
        : `Surah ${surah} · ${startAyah}–${endAyah}`

  const modeSubtitle = mode === 'surah' ? 'Surah' : mode === 'juz' ? 'Juz' : 'Range'

  const currentSurahNum = Number(startVerseKey.split(':')[0] || 1)
  const surahTitle =
    chapters.find((c) => c.id === currentSurahNum)?.englishName || `Surah ${currentSurahNum}`

  useEffect(() => {
    async function loadScope() {
      setLoading(true)

      try {
        let verses: Verse[] = []

        if (mode === 'surah') {
          verses = await getVersesByChapter(surah)
        } else if (mode === 'juz') {
          verses = await getVersesByJuz(juz)
        } else {
          const chapterVerses = await getVersesByChapter(surah)
          verses = chapterVerses.filter((v) => {
            const ayahNumber = Number(v.verse_key.split(':')[1])
            return ayahNumber >= startAyah && ayahNumber <= endAyah
          })
        }

        if (verses.length === 0) {
          throw new Error('No verses found in this selection.')
        }

        const visualPageMap =
          mode === 'juz'
            ? await getVisualPagesForScope({ juz })
            : await getVisualPagesForScope({ chapter: surah })
        
        const pageToVerses = new Map<number, Verse[]>()
        for (const v of verses) {
          const page = visualPageMap[v.verse_key] || v.page_number || 1
          if (!pageToVerses.has(page)) pageToVerses.set(page, [])
          pageToVerses.get(page)!.push(v)
        }
        
        const candidateVerses = verses.filter(v => {
          const page = visualPageMap[v.verse_key] || v.page_number || 1
          const pageVerses = pageToVerses.get(page) || []
          const verseIdx = pageVerses.findIndex(pv => pv.verse_key === v.verse_key)
          return verseIdx > 0 && verseIdx < pageVerses.length - 1
        })
        
        const safeCandidates = candidateVerses.length > 0 ? candidateVerses : verses
        const randomVerse = safeCandidates[Math.floor(Math.random() * safeCandidates.length)]
        const startPage =
          visualPageMap[randomVerse.verse_key] ||
          (await getVisualPageForVerse(randomVerse.verse_key, randomVerse.page_number || 1))
        const pageVersesList = await getMushafPage(startPage)
        const availablePages = Array.from(
          new Set(verses.map((verse) => visualPageMap[verse.verse_key] || verse.page_number || 1))
        ).sort((a, b) => a - b)

        setStartVerseKey(randomVerse.verse_key)
        setQuestionVerseKey(randomVerse.verse_key)
        setQuestionPage(startPage)
        setScopeVerseKeys(new Set(verses.map((v) => v.verse_key)))
        setPageVerses(pageVersesList)
        setCurrentPage(startPage)
        setScopePages(availablePages)
        setRevealedAyahs(new Set([randomVerse.verse_key]))
        setPhase('testing')
      } catch (err) {
        console.error('Failed to load scope:', err)
      } finally {
        setLoading(false)
      }
    }
    loadScope()
  }, [mode, surah, juz, startAyah, endAyah, randomNonce])

  const handleReveal = (verseKey: string) => {
    const nextRevealedAyahs = new Set([...revealedAyahs, verseKey])
    setRevealedAyahs(nextRevealedAyahs)
  }

  const handleNextPage = () => {
    const currentIndex = scopePages.indexOf(currentPage)
    const nextPage = scopePages[currentIndex + 1]

    if (nextPage) {
      setNavDirection('forward')
      loadPageVerses(nextPage)
    }
  }

  const handlePreviousPage = () => {
    const currentIndex = scopePages.indexOf(currentPage)
    const previousPage = scopePages[currentIndex - 1]

    if (previousPage) {
      setNavDirection('backward')
      loadPageVerses(previousPage)
    }
  }

  const loadPageVerses = async (page: number) => {
    try {
      let verses: Verse[] = []

      if (mode === 'surah') {
        verses = await getVersesByChapter(surah)
      } else if (mode === 'juz') {
        verses = await getVersesByJuz(juz)
      } else {
        const chapterVerses = await getVersesByChapter(surah)
        verses = chapterVerses.filter((v) => {
          const ayahNumber = Number(v.verse_key.split(':')[1])
          return ayahNumber >= startAyah && ayahNumber <= endAyah
        })
      }

      const pageVersesList = await getMushafPage(page)
      const visualPageMap =
        mode === 'juz'
          ? await getVisualPagesForScope({ juz })
          : await getVisualPagesForScope({ chapter: surah })

      const pageVerseKeys = new Set(
        verses.filter((v) => (visualPageMap[v.verse_key] || v.page_number) === page).map((v) => v.verse_key)
      )

      let startVerse: Verse | undefined
      if (questionVerseKey && pageVerseKeys.has(questionVerseKey)) {
        startVerse = verses.find((v) => v.verse_key === questionVerseKey)
      } else if (navDirection === 'backward') {
        const pageVersesInScope = verses.filter((v) => pageVerseKeys.has(v.verse_key))
        startVerse = pageVersesInScope[pageVersesInScope.length - 1]
      } else {
        startVerse = verses.find((v) => (visualPageMap[v.verse_key] || v.page_number) === page) || pageVersesList[0]
      }

      setScopeVerseKeys(new Set(verses.map((v) => v.verse_key)))
      setPageVerses(pageVersesList)
      setCurrentPage(page)
      setStartVerseKey(startVerse?.verse_key || '')
      setPhase('testing')
      setNavDirection(null)
      setPhase('testing')
    } catch (err) {
      console.error('Failed to load page:', err)
    }
  }

  const handleNewRandom = () => {
    setRandomNonce((prev) => prev + 1)
  }

  const revealedCount = revealedAyahs.size
  const startIndex = pageVerses.findIndex((v) => v.verse_key === startVerseKey)
  const revealablePageVerses =
    startIndex >= 0
      ? pageVerses.slice(startIndex).filter((v) => scopeVerseKeys.has(v.verse_key))
      : pageVerses.filter((v) => scopeVerseKeys.has(v.verse_key))
  const totalCount = revealablePageVerses.length
  const progress = totalCount > 0 ? Math.round((revealedCount / totalCount) * 100) : 0
  const currentPageIndex = scopePages.indexOf(currentPage)
  const hasPreviousPage = currentPageIndex > 0 && currentPage > questionPage
  const pageComplete = totalCount > 0 && revealedCount >= totalCount
  const hasNextPage = pageComplete && currentPageIndex >= 0 && currentPageIndex < scopePages.length - 1

  if (loading) {
    return (
      <main className="min-h-screen bg-[var(--hifdh-bg)]">
        <div className="mx-auto flex max-w-lg flex-col items-center justify-center px-4 py-24">
          <div
            className="mb-4 h-8 w-8 rounded-full border-2 border-stone-200 border-t-teal-700 motion-safe:animate-spin"
            role="status"
            aria-label="Loading"
          />
          <p className="text-sm text-[var(--hifdh-muted)]">Loading session…</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[var(--hifdh-bg)] text-[var(--hifdh-text)]">
      <header className="sticky top-0 z-20 border-b border-[var(--hifdh-border)] bg-[var(--hifdh-bg)]/90 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div>
            <p className="font-serif text-lg font-medium leading-tight text-[var(--hifdh-text)]">
              {surahTitle}
            </p>
            <p className="text-[11px] text-[var(--hifdh-muted)]">
              {scopeLabel} · {modeSubtitle} · Page {currentPage}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Link
              href="/"
              className="rounded-full px-3 py-2 text-xs text-[var(--hifdh-muted)] transition-colors hover:bg-stone-100 hover:text-stone-900 dark:hover:bg-stone-800 dark:hover:text-stone-100"
            >
              Change scope
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full px-3 pb-12 pt-4 sm:px-5">
        {phase === 'testing' && (
          <>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-800">
                <div
                  className="h-full bg-teal-600 transition-all duration-300 dark:bg-teal-400"
                  style={{ width: `${progress}%` }}
                  role="progressbar"
                  aria-valuenow={progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                />
              </div>
            </div>

            <div className="mb-5">
              <QuranPageView
                verses={pageVerses}
                startVerseKey={startVerseKey}
                revealableVerseKeys={scopeVerseKeys}
                revealedAyahs={revealedAyahs}
                onReveal={handleReveal}
              />
            </div>

            

            <div className="mx-auto mb-4 flex max-w-3xl items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleNextPage}
                disabled={!hasNextPage}
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={handlePreviousPage}
                disabled={!hasPreviousPage}
              >
                <ChevronRight className="h-4 w-4" aria-hidden />
              </Button>
            </div>

            {!online && (
              <div className="mx-auto mb-4 max-w-3xl rounded-lg bg-amber-50 p-3 text-[12px] text-amber-900 dark:bg-amber-400/10 dark:text-amber-200">
                <div className="flex items-start gap-2">
                  <WifiOff className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
                  <p>
                    You are offline. The page view works without internet. Transcription will be
                    available when you're back online.
                  </p>
                </div>
              </div>
            )}

            <div className="mx-auto max-w-3xl">
              <Button variant="primary" size="lg" className="w-full" onClick={handleNewRandom}>
                <RefreshCw className="h-4 w-4" aria-hidden />
                New random verse
              </Button>
            </div>
          </>
        )}
      </div>
    </main>
  )
}

export default function TestPage() {
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
      <TestPageContent />
    </Suspense>
  )
}
