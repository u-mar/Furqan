'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  ChevronLeft,
  ChevronRight,
  Dices,
  RefreshCw,
  WifiOff,
} from 'lucide-react'
import HomeScreen from '@/components/home/HomeScreen'
import MushafFontPreload from '@/components/mushaf/MushafFontPreload'
import QuranPageView from '@/components/QuranPageView'
import Button from '@/components/ui/Button'
import {
  getChapters,
  getMushafPage,
  getVersesByChapter,
  getVersesByJuz,
  getVisualPageForVerse,
  getVisualPagesForScope,
} from '@/lib/quran'
import { cn } from '@/lib/cn'
import type { Chapter, ScopeMode, ScopeType, Verse } from '@/types'

type Phase = 'idle' | 'testing'

function resolveScopeType(mode: ScopeMode, scopeParam: string | null): ScopeType {
  if (scopeParam === 'juz' || scopeParam === 'range' || scopeParam === 'surah') {
    return scopeParam
  }
  if (mode === 'juz') return 'juz'
  if (mode === 'range') return 'range'
  return 'surah'
}

async function loadScopeVerses(
  scope: ScopeType,
  surah: number,
  juz: number,
  startSurah: number,
  endSurah: number
): Promise<{ verses: Verse[]; visualPageMap: Record<string, number> }> {
  if (scope === 'juz') {
    const [verses, visualPageMap] = await Promise.all([
      getVersesByJuz(juz),
      getVisualPagesForScope({ juz }),
    ])
    return { verses, visualPageMap }
  }

  if (scope === 'range') {
    const from = Math.min(startSurah, endSurah)
    const to = Math.max(startSurah, endSurah)
    const verses: Verse[] = []
    const visualPageMap: Record<string, number> = {}

    for (let chapterId = from; chapterId <= to; chapterId++) {
      const [chapterVerses, chapterMap] = await Promise.all([
        getVersesByChapter(chapterId),
        getVisualPagesForScope({ chapter: chapterId }),
      ])
      verses.push(...chapterVerses)
      Object.assign(visualPageMap, chapterMap)
    }

    return { verses, visualPageMap }
  }

  const [verses, visualPageMap] = await Promise.all([
    getVersesByChapter(surah),
    getVisualPagesForScope({ chapter: surah }),
  ])
  return { verses, visualPageMap }
}

function TestPageContent() {
  const searchParams = useSearchParams()
  const mode = (searchParams.get('mode') || 'random') as ScopeMode
  const scope = resolveScopeType(mode, searchParams.get('scope'))
  const surah = Number(searchParams.get('surah') || '1')
  const juz = Number(searchParams.get('juz') || '1')
  const startSurah = Number(searchParams.get('startSurah') || searchParams.get('surah') || '1')
  const endSurah = Number(searchParams.get('endSurah') || searchParams.get('surah') || '1')
  const participants = Math.max(2, Number(searchParams.get('participants') || '2'))

  const [chapters, setChapters] = useState<Chapter[]>([])
  const [pageVerses, setPageVerses] = useState<Verse[]>([])
  const [scopeVerseKeys, setScopeVerseKeys] = useState<Set<string>>(new Set())
  const [cachedScopeVerses, setCachedScopeVerses] = useState<Verse[]>([])
  const [cachedVisualPageMap, setCachedVisualPageMap] = useState<Record<string, number>>({})
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
  const [subacAssignments, setSubacAssignments] = useState<string[]>([])
  const [currentParticipant, setCurrentParticipant] = useState(0)
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
    scope === 'juz'
      ? `Juz ${juz}`
      : scope === 'range'
        ? `Surah ${Math.min(startSurah, endSurah)}–${Math.max(startSurah, endSurah)}`
        : `Surah ${surah}`


  const currentSurahNum = Number(startVerseKey.split(':')[0] || 1)
  const surahTitle =
    chapters.find((c) => c.id === currentSurahNum)?.englishName || `Surah ${currentSurahNum}`

  useEffect(() => {
    async function loadScope() {
      setLoading(true)

      try {
        const { verses, visualPageMap } = await loadScopeVerses(
          scope,
          surah,
          juz,
          startSurah,
          endSurah
        )

        if (verses.length === 0) {
          throw new Error('No verses found in this selection.')
        }

        setCachedScopeVerses(verses)
        setCachedVisualPageMap(visualPageMap)

        let targetVerse: Verse

        if (mode === 'subac') {
          const assignments = verses
            .slice(0, Math.min(participants, verses.length))
            .map((v) => v.verse_key)
          setSubacAssignments(assignments)
          setCurrentParticipant(0)
          const firstKey = assignments[0]
          targetVerse = verses.find((v) => v.verse_key === firstKey) ?? verses[0]
        } else {
          const pageToVerses = new Map<number, Verse[]>()
          for (const v of verses) {
            const page = visualPageMap[v.verse_key] || v.page_number || 1
            if (!pageToVerses.has(page)) pageToVerses.set(page, [])
            pageToVerses.get(page)!.push(v)
          }

          const candidateVerses = verses.filter((v) => {
            const page = visualPageMap[v.verse_key] || v.page_number || 1
            const pageVersesOnPage = pageToVerses.get(page) || []
            const verseIdx = pageVersesOnPage.findIndex((pv) => pv.verse_key === v.verse_key)
            return verseIdx > 0 && verseIdx < pageVersesOnPage.length - 1
          })

          const safeCandidates = candidateVerses.length > 0 ? candidateVerses : verses
          targetVerse = safeCandidates[Math.floor(Math.random() * safeCandidates.length)]
        }

        const startPage =
          visualPageMap[targetVerse.verse_key] ||
          (await getVisualPageForVerse(targetVerse.verse_key, targetVerse.page_number || 1))
        const pageVersesList = await getMushafPage(startPage)
        const availablePages = Array.from(
          new Set(verses.map((verse) => visualPageMap[verse.verse_key] || verse.page_number || 1))
        ).sort((a, b) => a - b)

        setStartVerseKey(targetVerse.verse_key)
        setQuestionVerseKey(targetVerse.verse_key)
        setQuestionPage(startPage)
        setScopeVerseKeys(new Set(verses.map((v) => v.verse_key)))
        setPageVerses(pageVersesList)
        setCurrentPage(startPage)
        setScopePages(availablePages)
        setRevealedAyahs(new Set([targetVerse.verse_key]))
        setPhase('testing')
      } catch (err) {
        console.error('Failed to load scope:', err)
      } finally {
        setLoading(false)
      }
    }
    loadScope()
  }, [mode, scope, surah, juz, startSurah, endSurah, participants, randomNonce])

  const handleReveal = (verseKey: string) => {
    setRevealedAyahs(new Set([...revealedAyahs, verseKey]))
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
      const pageVersesList = await getMushafPage(page)
      const pageVerseKeys = new Set(
        cachedScopeVerses
          .filter((v) => (cachedVisualPageMap[v.verse_key] || v.page_number) === page)
          .map((v) => v.verse_key)
      )

      let startVerse: Verse | undefined
      if (questionVerseKey && pageVerseKeys.has(questionVerseKey)) {
        startVerse = cachedScopeVerses.find((v) => v.verse_key === questionVerseKey)
      } else if (navDirection === 'backward') {
        const pageVersesInScope = cachedScopeVerses.filter((v) => pageVerseKeys.has(v.verse_key))
        startVerse = pageVersesInScope[pageVersesInScope.length - 1]
      } else {
        startVerse =
          cachedScopeVerses.find(
            (v) => (cachedVisualPageMap[v.verse_key] || v.page_number) === page
          ) || pageVersesList[0]
      }

      setPageVerses(pageVersesList)
      setCurrentPage(page)
      setStartVerseKey(startVerse?.verse_key || '')
      setPhase('testing')
      setNavDirection(null)
    } catch (err) {
      console.error('Failed to load page:', err)
    }
  }

  const handleNewRandom = () => setRandomNonce((prev) => prev + 1)

  const handleNextParticipant = async () => {
    const next = currentParticipant + 1
    if (next >= subacAssignments.length) return

    const verseKey = subacAssignments[next]
    const verse = cachedScopeVerses.find((v) => v.verse_key === verseKey)
    if (!verse) return

    try {
      const page =
        cachedVisualPageMap[verseKey] ||
        (await getVisualPageForVerse(verseKey, verse.page_number || 1))
      const pageVersesList = await getMushafPage(page)

      setCurrentParticipant(next)
      setStartVerseKey(verseKey)
      setQuestionVerseKey(verseKey)
      setQuestionPage(page)
      setPageVerses(pageVersesList)
      setCurrentPage(page)
      setRevealedAyahs(new Set([verseKey]))
      setPhase('testing')
    } catch (err) {
      console.error('Failed to load participant ayah:', err)
    }
  }

  const startIndexForReveal = pageVerses.findIndex((v) => v.verse_key === startVerseKey)
  const nextAyahToReveal = pageVerses
    .slice(startIndexForReveal >= 0 ? startIndexForReveal : 0)
    .find((v) => scopeVerseKeys.has(v.verse_key) && !revealedAyahs.has(v.verse_key))

  const activeRevealKeys =
    mode === 'subac' && subacAssignments[currentParticipant]
      ? new Set<string>()
      : nextAyahToReveal
        ? new Set([nextAyahToReveal.verse_key])
        : new Set<string>()

  const revealedCount = revealedAyahs.size
  const startIndex = pageVerses.findIndex((v) => v.verse_key === startVerseKey)
  const revealablePageVerses =
    startIndex >= 0
      ? pageVerses.slice(startIndex).filter((v) => scopeVerseKeys.has(v.verse_key))
      : pageVerses.filter((v) => scopeVerseKeys.has(v.verse_key))
  const totalCount = revealablePageVerses.length
  const progress =
    mode === 'subac' && subacAssignments.length > 0
      ? Math.round(((currentParticipant + 1) / subacAssignments.length) * 100)
      : totalCount > 0
        ? Math.round((revealedCount / totalCount) * 100)
        : 0

  const currentPageIndex = scopePages.indexOf(currentPage)
  const hasPreviousPage = currentPageIndex > 0 && currentPage > questionPage
  const pageComplete = totalCount > 0 && revealedCount >= totalCount
  const hasNextPage =
    pageComplete && currentPageIndex >= 0 && currentPageIndex < scopePages.length - 1

  if (loading) {
    return (
      <HomeScreen className="flex flex-col items-center justify-center">
        <div
          className="h-9 w-9 animate-spin rounded-full border-2 border-[var(--app-border)] border-t-teal-600"
          role="status"
          aria-label="Loading"
        />
        <p className="mt-4 text-sm text-[var(--app-muted)]">Preparing your test…</p>
      </HomeScreen>
    )
  }

  return (
    <HomeScreen className={cn('pb-28', phase === 'testing' && 'flex min-h-[100dvh] flex-col')}>
      <MushafFontPreload />
      <header className="mb-3 flex shrink-0 items-start justify-between gap-3 border-b border-[var(--home-card-border)] pb-3">
        <div className="flex min-w-0 items-start gap-2">
          <Link
            href="/test/select/random"
            className="mt-0.5 flex min-h-[40px] min-w-[40px] shrink-0 items-center justify-center rounded-xl text-[var(--home-sage-deep)] transition-colors hover:bg-[var(--home-sage-soft)]"
            aria-label="Back to setup"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Dices className="h-4 w-4 shrink-0 text-[var(--home-sage-deep)]" />
              <p className="home-serif truncate text-lg font-semibold text-[var(--home-heading)]">
                {surahTitle}
              </p>
            </div>
            <p className="mt-0.5 text-xs text-[var(--home-muted)]">
              {mode === 'subac' && subacAssignments.length > 0
                ? `Person ${currentParticipant + 1} of ${subacAssignments.length} · Ayah ${startVerseKey.split(':')[1] || ''}`
                : `${scopeLabel} · Ayah ${startVerseKey.split(':')[1] || ''} · Page ${currentPage}`}
            </p>
          </div>
        </div>
        <Link
          href="/test/select"
          className="shrink-0 rounded-full border border-[var(--home-card-border)] bg-[var(--home-card-bg)] px-3 py-1.5 text-xs font-medium text-[var(--home-muted)] transition-colors hover:text-[var(--home-heading)]"
        >
          Change
        </Link>
      </header>

      {phase === 'testing' && (
        <>
          <div className="mb-3 flex shrink-0 items-center gap-3">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--home-card-border)]">
              <div
                className="h-full rounded-full bg-[var(--home-sage-deep)] transition-all duration-300"
                style={{ width: `${progress}%` }}
                role="progressbar"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
            <span className="text-[11px] font-medium tabular-nums text-[var(--home-muted)]">
              {progress}%
            </span>
          </div>

          <p className="mb-3 shrink-0 text-center text-xs text-[var(--home-muted)]">
            Tap where the next ayah continues to reveal it
          </p>

          <div className="mushaf-reader-immersive relative mb-4 min-h-0 flex-1 overflow-hidden rounded-2xl bg-[var(--mushaf-read-bg)] shadow-[var(--home-card-shadow)]">
            <QuranPageView
              verses={pageVerses}
              startVerseKey={startVerseKey}
              revealableVerseKeys={activeRevealKeys}
              revealedAyahs={revealedAyahs}
              onReveal={handleReveal}
              readMode
              hideRevealBoxes
              pageNumber={currentPage}
            />
          </div>

          {!online && (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-900 dark:text-amber-200">
              <WifiOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <p>Offline — mushaf works; transcription needs internet.</p>
            </div>
          )}

          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--home-card-border)] bg-[var(--app-bg)]/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
            <div className="mx-auto flex max-w-lg items-center gap-2">
              <Button
                variant="secondary"
                size="md"
                className="shrink-0 border-[var(--home-card-border)] px-3"
                onClick={handlePreviousPage}
                disabled={!hasPreviousPage}
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              {mode === 'subac' ? (
                <button
                  type="button"
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[var(--home-sage-deep)] px-4 py-3 text-sm font-semibold text-white transition-colors hover:brightness-105 disabled:opacity-40"
                  onClick={handleNextParticipant}
                  disabled={currentParticipant >= subacAssignments.length - 1}
                >
                  Next person
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[var(--home-sage-deep)] px-4 py-3 text-sm font-semibold text-white transition-colors hover:brightness-105"
                  onClick={handleNewRandom}
                >
                  <RefreshCw className="h-4 w-4" />
                  New random ayah
                </button>
              )}

              <Button
                variant="secondary"
                size="md"
                className="shrink-0 border-[var(--home-card-border)] px-3"
                onClick={handleNextPage}
                disabled={!hasNextPage}
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </HomeScreen>
  )
}

export default function TestPage() {
  return (
    <Suspense
      fallback={
        <HomeScreen className="flex items-center justify-center">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-[var(--app-border)] border-t-teal-600" />
        </HomeScreen>
      }
    >
      <TestPageContent />
    </Suspense>
  )
}
