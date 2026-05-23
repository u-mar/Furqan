'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  Menu,
  Search,
  Calendar,
  Settings,
  Play,
  Square,
  MessageSquareText,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
} from 'lucide-react'
import QuranPageView from '@/components/QuranPageView'
import SurahSearchModal from '@/components/read/SurahSearchModal'
import ContentsDrawer from '@/components/read/ContentsDrawer'
import MushafTranslationView from '@/components/read/MushafTranslationView'
import ReciterPicker from '@/components/read/ReciterPicker'
import AyahActionSheet from '@/components/read/AyahActionSheet'
import MushafPageCarousel, { type PageSlideDirection } from '@/components/read/MushafPageCarousel'
import { useSwipe } from '@/hooks/useSwipe'
import { useAppSettings } from '@/hooks/useAppSettings'
import { usePageRecitation } from '@/hooks/usePageRecitation'
import { usePageTranslations } from '@/hooks/usePageTranslations'
import { getAppSettings } from '@/lib/app-settings'
import { cn } from '@/lib/cn'
import {
  clampPage,
  juzForChapter,
  LAST_READ_PAGE_KEY,
  TOTAL_MUSHAF_PAGES,
} from '@/lib/mushaf'
import {
  getChapters,
  getMushafPage,
  getVersesByChapter,
  getVisualPageForVerse,
} from '@/lib/quran'
import { getLocalMushafPage, isOfflineReady, prefetchMushafPages } from '@/lib/local-quran-store'
import { prefetchPageFonts } from '@/lib/mushaf-fonts'
import type { Chapter, Verse } from '@/types'

function ReadPageContent() {
  const searchParams = useSearchParams()
  const initialPage = Number(searchParams.get('page') || '0')

  const [chapters, setChapters] = useState<Chapter[]>([])
  const [pageVerses, setPageVerses] = useState<Verse[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [uiVisible, setUiVisible] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [showTranslation, setShowTranslation] = useState(false)
  const [sliderPage, setSliderPage] = useState(1)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [pageLoading, setPageLoading] = useState(false)
  const didSwipe = useRef(false)
  const longPressBlockTap = useRef(false)
  const pageVersesRef = useRef<Verse[]>([])
  const initialLoadDone = useRef(false)
  const { mushafStyle, reciterId, verticalPages, translationLanguage } = useAppSettings()
  const [ayahMenu, setAyahMenu] = useState<{ verseKey: string; arabic: string } | null>(null)
  const [pageSlide, setPageSlide] = useState<{
    direction: PageSlideDirection
    incomingVerses: Verse[]
    incomingPage: number
  } | null>(null)

  const fetchVersesForPage = useCallback(async (page: number): Promise<Verse[]> => {
    const next = clampPage(page)
    const instant = isOfflineReady() ? getLocalMushafPage(next) : null
    if (instant && instant.length > 0) return instant
    return getMushafPage(next)
  }, [])

  const applyPage = useCallback((page: number, verses: Verse[]) => {
    pageVersesRef.current = verses
    setPageVerses(verses)
    setCurrentPage(page)
    setSliderPage(page)
    setLoadError(null)
    localStorage.setItem(LAST_READ_PAGE_KEY, String(page))
    prefetchMushafPages(page, 3)
    prefetchPageFonts(page, 2)
  }, [])

  const loadPage = useCallback(
    async (page: number) => {
      const next = clampPage(page)
      setLoadError(null)

      const instant = isOfflineReady() ? getLocalMushafPage(next) : null
      if (instant && instant.length > 0) {
        applyPage(next, instant)
        setLoading(false)
        setPageLoading(false)
        return
      }

      if (pageVersesRef.current.length === 0) setLoading(true)
      else setPageLoading(true)

      try {
        const verses = await getMushafPage(next)
        applyPage(next, verses)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load page'
        console.error('Failed to load page:', err)
        setLoadError(message)
      } finally {
        setLoading(false)
        setPageLoading(false)
      }
    },
    [applyPage]
  )

  const handleSlideSettled = useCallback(() => {
    setPageSlide((slide) => {
      if (!slide) return null
      applyPage(slide.incomingPage, slide.incomingVerses)
      setPageLoading(false)
      return null
    })
  }, [applyPage])

  const { state: recitation, stop: stopRecitation, start: startRecitation, playVerse, isActive } =
    usePageRecitation({
      reciterId,
      verses: pageVerses,
    })

  const arabicByKey = useMemo(
    () => Object.fromEntries(pageVerses.map((v) => [v.verse_key, v.text_uthmani])),
    [pageVerses]
  )
  const { byKey: translationByKey, loading: ayahTranslationLoading } = usePageTranslations(
    currentPage,
    Boolean(ayahMenu),
    pageVerses.map((v) => v.verse_key),
    arabicByKey,
    translationLanguage
  )

  const navigatePage = useCallback(
    async (page: number) => {
      const next = clampPage(page)
      if (next === currentPage || pageSlide) return
      stopRecitation()

      if (!verticalPages || showTranslation) {
        void loadPage(next)
        return
      }

      setPageLoading(true)
      setLoadError(null)
      try {
        const incomingVerses = await fetchVersesForPage(next)
        const direction: PageSlideDirection = next > currentPage ? 'next' : 'prev'
        setPageSlide({ direction, incomingVerses, incomingPage: next })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load page'
        console.error('Failed to load page:', err)
        setLoadError(message)
        setPageLoading(false)
      }
    },
    [currentPage, fetchVersesForPage, loadPage, pageSlide, showTranslation, stopRecitation, verticalPages]
  )

  useEffect(() => {
    getChapters().then(setChapters).catch(() => {})
    const settings = getAppSettings()
    if (settings.offlineDownloaded && !isOfflineReady()) {
      import('@/lib/local-quran-store').then(({ hydrateOfflineFromDisk }) => {
        hydrateOfflineFromDisk().catch(() => {})
      })
    }
  }, [])

  useEffect(() => {
    if (initialLoadDone.current) return
    initialLoadDone.current = true
    const saved =
      initialPage > 0
        ? initialPage
        : typeof window !== 'undefined'
          ? Number(localStorage.getItem(LAST_READ_PAGE_KEY) || '1')
          : 1
    void loadPage(clampPage(saved || 1))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPage])

  const goToSurah = async (surahId: number) => {
    stopRecitation()
    const verses = await getVersesByChapter(surahId)
    const first = verses[0]
    if (!first) return
    const page = await getVisualPageForVerse(first.verse_key, first.page_number || 1)
    await loadPage(page)
  }

  const handleSelectSurah = async (surahId: number) => {
    setSearchOpen(false)
    setDrawerOpen(false)
    await goToSurah(surahId)
  }

  const openSearch = () => {
    setUiVisible(true)
    setSearchOpen(true)
  }

  const pageVerseKeys = useMemo(() => new Set(pageVerses.map((v) => v.verse_key)), [pageVerses])
  const startVerseKey = pageVerses[0]?.verse_key || ''
  const currentSurahNum = Number(startVerseKey.split(':')[0] || 1)
  const surahTitle =
    chapters.find((c) => c.id === currentSurahNum)?.englishName || `Surah ${currentSurahNum}`
  const juzPart = juzForChapter(currentSurahNum)

  const handleRecitationToggle = () => {
    if (isActive) {
      stopRecitation()
      return
    }
    setUiVisible(true)
    startRecitation()
  }

  const handleAyahLongPress = (verseKey: string) => {
    longPressBlockTap.current = true
    const verse = pageVerses.find((v) => v.verse_key === verseKey)
    if (!verse) return
    setAyahMenu({ verseKey, arabic: verse.text_uthmani })
  }

  const getNextVerseOnPage = useCallback(
    (verseKey: string) => {
      const idx = pageVerses.findIndex((v) => v.verse_key === verseKey)
      if (idx < 0 || idx >= pageVerses.length - 1) return null
      return pageVerses[idx + 1]
    },
    [pageVerses]
  )

  const handleAyahMenuNext = useCallback(() => {
    if (!ayahMenu) return
    const next = getNextVerseOnPage(ayahMenu.verseKey)
    if (!next) return
    setAyahMenu({ verseKey: next.verse_key, arabic: next.text_uthmani })
    if (isActive) playVerse(next.verse_key)
  }, [ayahMenu, getNextVerseOnPage, isActive, playVerse])

  const ayahMenuHasNext = ayahMenu ? Boolean(getNextVerseOnPage(ayahMenu.verseKey)) : false
  const isRecitingAyahMenu =
    Boolean(ayahMenu) && recitation.highlightedVerseKey === ayahMenu?.verseKey

  const renderMushafPage = useCallback(
    (verses: Verse[], pageNum: number) => {
      const keys = new Set(verses.map((v) => v.verse_key))
      const start = verses[0]?.verse_key || ''
      return (
        <QuranPageView
          key={pageNum}
          verses={verses}
          startVerseKey={start}
          revealableVerseKeys={keys}
          revealedAyahs={keys}
          onReveal={() => {}}
          readOnly
          readMode
          mushafStyle={mushafStyle}
          pageNumber={pageNum}
          highlightedVerseKey={recitation.highlightedVerseKey}
          selectedVerseKey={ayahMenu?.verseKey ?? null}
          onAyahLongPress={handleAyahLongPress}
        />
      )
    },
    [ayahMenu?.verseKey, mushafStyle, recitation.highlightedVerseKey]
  )

  const toggleUi = () => setUiVisible((v) => !v)

  const goNextPage = useCallback(() => {
    if (currentPage < TOTAL_MUSHAF_PAGES) void navigatePage(currentPage + 1)
  }, [currentPage, navigatePage])

  const goPrevPage = useCallback(() => {
    if (currentPage > 1) void navigatePage(currentPage - 1)
  }, [currentPage, navigatePage])

  const swipe = useSwipe(
    verticalPages
      ? {
          direction: 'vertical',
          onSwipeUp: () => {
            didSwipe.current = true
            goNextPage()
          },
          onSwipeDown: () => {
            didSwipe.current = true
            goPrevPage()
          },
        }
      : {
          direction: 'horizontal',
          onSwipeLeft: () => {
            didSwipe.current = true
            goPrevPage()
          },
          onSwipeRight: () => {
            didSwipe.current = true
            goNextPage()
          },
        }
  )

  const handleContentTap = () => {
    if (didSwipe.current) {
      didSwipe.current = false
      return
    }
    if (longPressBlockTap.current) {
      longPressBlockTap.current = false
      return
    }
    toggleUi()
  }

  if (loading && pageVerses.length === 0 && !loadError) {
    return (
      <main className="mushaf-reader-immersive flex min-h-[100dvh] flex-col items-center justify-center gap-4 px-6">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-stone-700 border-t-teal-500"
          role="status"
          aria-label="Loading"
        />
        <p className="text-sm text-stone-500">Loading page…</p>
      </main>
    )
  }

  if (loadError && pageVerses.length === 0) {
    return (
      <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-[var(--app-bg)] px-6 text-center">
        <p className="text-sm text-red-400">{loadError}</p>
        <p className="text-xs text-stone-500">
          Check your Wi‑Fi connection. The first load can take up to a minute.
        </p>
        <button
          type="button"
          onClick={() => loadPage(currentPage)}
          className="rounded-xl bg-teal-600 px-6 py-2.5 text-sm font-semibold text-white"
        >
          Retry
        </button>
        <Link href="/settings" className="text-sm text-[var(--app-muted)] underline">
          Download offline in Settings
        </Link>
      </main>
    )
  }

  return (
    <main className="mushaf-reader-immersive relative flex h-[100dvh] flex-col overflow-hidden">
      {pageLoading && (
        <div
          className="absolute inset-x-0 top-0 z-40 h-0.5 overflow-hidden bg-teal-900/30"
          role="status"
          aria-label="Loading page"
        >
          <div className="h-full w-1/3 animate-pulse bg-teal-500" />
        </div>
      )}

      {/* Minimal header — always visible (like reference app) */}
      <div
        className="relative z-10 flex shrink-0 items-center justify-between px-5 pb-1 pt-[max(0.65rem,env(safe-area-inset-top))]"
        dir="ltr"
      >
        <span className="text-sm text-[var(--mushaf-read-meta)]">{surahTitle}</span>
        <span className="text-sm text-[var(--mushaf-read-meta)]">Part {juzPart}</span>
      </div>

      {/* Mushaf body — fixed fit when reading; scroll when translation */}
      <div
        className={cn(
          'relative min-h-0 flex-1 px-4',
          showTranslation ? 'overflow-y-auto overscroll-contain pb-36' : 'overflow-hidden pb-14'
        )}
        onClick={handleContentTap}
        onTouchStart={showTranslation || pageSlide ? undefined : swipe.onTouchStart}
        onTouchEnd={showTranslation || pageSlide ? undefined : swipe.onTouchEnd}
        role="presentation"
      >
        {showTranslation ? (
          <MushafTranslationView
            verses={pageVerses}
            page={currentPage}
            chapters={chapters}
            translationLanguage={translationLanguage}
            highlightedVerseKey={recitation.highlightedVerseKey}
          />
        ) : verticalPages ? (
          <MushafPageCarousel
            vertical
            slide={
              pageSlide
                ? {
                    direction: pageSlide.direction,
                    incoming: renderMushafPage(pageSlide.incomingVerses, pageSlide.incomingPage),
                  }
                : null
            }
            onSettled={handleSlideSettled}
          >
            {renderMushafPage(pageVerses, currentPage)}
          </MushafPageCarousel>
        ) : (
          <QuranPageView
            verses={pageVerses}
            startVerseKey={startVerseKey}
            revealableVerseKeys={pageVerseKeys}
            revealedAyahs={pageVerseKeys}
            onReveal={() => {}}
            readOnly
            readMode
            mushafStyle={mushafStyle}
            pageNumber={currentPage}
            highlightedVerseKey={recitation.highlightedVerseKey}
            selectedVerseKey={ayahMenu?.verseKey ?? null}
            onAyahLongPress={handleAyahLongPress}
          />
        )}
      </div>

      {/* Page badge — bottom left */}
      {!showTranslation && (
        <div
          className="mushaf-page-badge pointer-events-none absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-5 z-10 rounded-md px-2.5 py-1 text-sm font-medium tabular-nums"
          dir="ltr"
          aria-hidden
        >
          {currentPage}
        </div>
      )}

      {/* Expanded chrome (menu, slider) — tap screen to toggle */}
      <header
        className={cn(
          'absolute inset-x-0 top-0 z-30 flex items-center justify-between border-b border-white/10 bg-black/90 px-4 py-3 backdrop-blur transition-transform duration-300',
          uiVisible ? 'translate-y-0' : '-translate-y-full'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="rounded-lg p-2 text-teal-400 hover:bg-white/5"
          aria-label="Open contents"
        >
          <Menu className="h-6 w-6" />
        </button>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={openSearch}
            className="rounded-lg p-2 text-teal-400 hover:bg-white/5"
            aria-label="Search surah"
          >
            <Search className="h-5 w-5" />
          </button>
          <button type="button" className="rounded-lg p-2 text-teal-400 hover:bg-white/5" aria-label="Calendar">
            <Calendar className="h-5 w-5" />
          </button>
          <Link
            href="/settings"
            className="rounded-lg p-2 text-teal-600 hover:bg-black/5 dark:text-teal-400 dark:hover:bg-white/5"
            aria-label="Settings"
            onClick={(e) => e.stopPropagation()}
          >
            <Settings className="h-5 w-5" />
          </Link>
        </div>
      </header>

      {/* Bottom controls */}
      <div
        className={cn(
          'absolute inset-x-0 bottom-0 z-30 space-y-2 px-3 pb-4 transition-transform duration-300',
          uiVisible ? 'translate-y-0' : 'translate-y-full'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#1a1a1a]/95 px-4 py-3 backdrop-blur">
          <ReciterPicker reciterId={reciterId} />
          <button
            type="button"
            onClick={handleRecitationToggle}
            disabled={pageVerses.length === 0}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-teal-400 hover:bg-white/5 disabled:opacity-40"
            aria-label={isActive ? 'Stop recitation' : 'Play page recitation'}
          >
            {recitation.loading ? (
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-teal-400/30 border-t-teal-400" />
            ) : isActive ? (
              <Square className="h-5 w-5 fill-current" />
            ) : (
              <Play className="h-6 w-6 fill-current" />
            )}
          </button>
        </div>

        <div className="mx-auto flex max-w-lg items-center gap-2 rounded-xl border border-white/10 bg-[#1a1a1a]/95 px-3 py-3 backdrop-blur">
          <button
            type="button"
            onClick={goPrevPage}
            disabled={currentPage <= 1}
            className="flex min-h-[44px] min-w-[44px] flex-col items-center justify-center text-teal-600 disabled:opacity-30 dark:text-teal-400"
            aria-label="Previous page"
          >
            {verticalPages ? (
              <ChevronUp className="h-6 w-6" />
            ) : (
              <ChevronRight className="h-6 w-6" />
            )}
          </button>

          <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--app-muted)]">
              Page
            </span>
            <input
              type="range"
              min={1}
              max={TOTAL_MUSHAF_PAGES}
              value={sliderPage}
              onChange={(e) => setSliderPage(Number(e.target.value))}
              onMouseUp={() => {
                if (sliderPage !== currentPage) navigatePage(sliderPage)
              }}
              onTouchEnd={() => {
                if (sliderPage !== currentPage) navigatePage(sliderPage)
              }}
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-stone-300 accent-teal-600 dark:bg-stone-700 dark:accent-teal-500"
              aria-label="Page slider"
            />
            <span className="text-sm font-semibold tabular-nums text-[var(--app-text)]">
              {currentPage}
              <span className="font-normal text-[var(--app-muted)]"> / {TOTAL_MUSHAF_PAGES}</span>
            </span>
          </div>

          <button
            type="button"
            onClick={goNextPage}
            disabled={currentPage >= TOTAL_MUSHAF_PAGES}
            className="flex min-h-[44px] min-w-[44px] flex-col items-center justify-center text-teal-600 disabled:opacity-30 dark:text-teal-400"
            aria-label="Next page"
          >
            {verticalPages ? (
              <ChevronDown className="h-6 w-6" />
            ) : (
              <ChevronLeft className="h-6 w-6" />
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              stopRecitation()
              setShowTranslation((v) => !v)
            }}
            className={cn(
              'rounded-lg p-2 hover:bg-white/5',
              showTranslation ? 'bg-teal-600/20 text-teal-400' : 'text-teal-400'
            )}
            aria-label={showTranslation ? 'Hide translation' : 'Show translation'}
            aria-pressed={showTranslation}
          >
            <MessageSquareText className="h-5 w-5" />
          </button>
        </div>
      </div>

      <SurahSearchModal
        open={searchOpen}
        chapters={chapters}
        currentSurahId={currentSurahNum}
        onClose={() => setSearchOpen(false)}
        onSelectSurah={handleSelectSurah}
      />

      <ContentsDrawer
        open={drawerOpen}
        chapters={chapters}
        currentSurahId={currentSurahNum}
        onClose={() => setDrawerOpen(false)}
        onSelectSurah={handleSelectSurah}
        onGoToPage={navigatePage}
      />

      <AyahActionSheet
        open={Boolean(ayahMenu)}
        verseKey={ayahMenu?.verseKey ?? ''}
        arabicText={ayahMenu?.arabic ?? ''}
        translation={
          ayahMenu ? translationByKey[ayahMenu.verseKey]?.translation ?? null : null
        }
        translationLoading={ayahTranslationLoading}
        hasNextAyah={ayahMenuHasNext}
        isReciting={isActive}
        isRecitingThisAyah={isRecitingAyahMenu}
        onClose={() => {
          stopRecitation()
          setAyahMenu(null)
        }}
        onPlay={() => {
          if (ayahMenu) playVerse(ayahMenu.verseKey)
        }}
        onStopRecitation={stopRecitation}
        onNextAyah={handleAyahMenuNext}
      />

      {uiVisible && (
        <Link
          href="/"
          className="absolute left-4 top-16 z-20 rounded-full bg-black/50 px-3 py-1 text-xs text-stone-400"
          onClick={(e) => e.stopPropagation()}
        >
          Home
        </Link>
      )}
    </main>
  )
}

export default function ReadPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-[100dvh] items-center justify-center bg-[var(--app-bg)]">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-700 border-t-teal-500" />
        </main>
      }
    >
      <ReadPageContent />
    </Suspense>
  )
}
