'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type TouchEvent } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  Menu,
  Search,
  Settings,
  Play,
  Square,
  MessageSquareText,
  Volume2,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
} from 'lucide-react'
import QuranPageView from '@/components/QuranPageView'
import MushafFontPreload from '@/components/mushaf/MushafFontPreload'
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
import { useSomaliVoicePlayback } from '@/hooks/useSomaliVoicePlayback'
import { getAppSettings } from '@/lib/app-settings'
import { setSettingsReturnTo } from '@/lib/settings-return'
import { isBookmarked, toggleBookmark } from '@/lib/bookmarks'
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
import { getVerseArabicText } from '@/lib/quran-display'
import {
  hasSomaliVoiceForVerse,
  loadSomaliVoiceManifest,
  TAFSIR_UNAVAILABLE_MESSAGE,
} from '@/lib/somali-voice'
import type { SomaliVoiceSegment } from '@/lib/somali-voice'
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
  const translationTouchStart = useRef({ x: 0, y: 0 })
  const pageVersesRef = useRef<Verse[]>([])
  const initialLoadDone = useRef(false)
  const contentScrollRef = useRef<HTMLDivElement>(null)
  const somaliAutoRef = useRef(false)
  const playSomaliVoiceRef = useRef<(verseKey: string) => Promise<boolean>>(async () => false)
  const [somaliAutoPlaying, setSomaliAutoPlaying] = useState(false)
  const { reciterId, verticalPages, translationLanguage } = useAppSettings()
  const [ayahMenu, setAyahMenu] = useState<{ verseKey: string; arabic: string } | null>(null)
  const [ayahMenuBookmarked, setAyahMenuBookmarked] = useState(false)
  const [somaliVoiceAvailable, setSomaliVoiceAvailable] = useState(false)
  const [somaliNotice, setSomaliNotice] = useState<string | null>(null)
  const [pageSlide, setPageSlide] = useState<{
    direction: PageSlideDirection
    incomingVerses: Verse[]
    incomingPage: number
  } | null>(null)

  const fetchVersesForPage = useCallback(async (page: number): Promise<Verse[]> => {
    const next = clampPage(page)
    if (!isOfflineReady()) {
      const { ensureOfflineHydrated } = await import('@/lib/local-quran-store')
      await ensureOfflineHydrated().catch(() => {})
    }
    const instant = getLocalMushafPage(next)
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
  }, [])

  const loadPage = useCallback(
    async (page: number) => {
      const next = clampPage(page)
      setLoadError(null)

      if (!isOfflineReady()) {
        const { ensureOfflineHydrated } = await import('@/lib/local-quran-store')
        await ensureOfflineHydrated().catch(() => {})
      }
      const instant = getLocalMushafPage(next)
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

  const findNextSomaliVerse = useCallback(async (afterVerseKey?: string | null): Promise<string | null> => {
    const verses = pageVersesRef.current
    const startIndex = afterVerseKey
      ? Math.max(0, verses.findIndex((v) => v.verse_key === afterVerseKey) + 1)
      : 0

    for (const verse of verses.slice(startIndex)) {
      if (await hasSomaliVoiceForVerse(verse.verse_key)) return verse.verse_key
    }

    return null
  }, [])

  const handleSomaliSegmentEnd = useCallback(
    (segment: SomaliVoiceSegment) => {
      if (!somaliAutoRef.current) return

      void (async () => {
        const nextVerseKey = await findNextSomaliVerse(segment.verseKey)
        if (!nextVerseKey) {
          somaliAutoRef.current = false
          setSomaliAutoPlaying(false)
          return
        }

        await playSomaliVoiceRef.current(nextVerseKey)
      })()
    },
    [findNextSomaliVerse]
  )

  const {
    state: somaliVoiceState,
    playVerse: playSomaliVoice,
    stop: stopSomaliVoice,
    isActive: isSomaliVoiceActive,
  } = useSomaliVoicePlayback({ onSegmentEnd: handleSomaliSegmentEnd })

  useEffect(() => {
    playSomaliVoiceRef.current = playSomaliVoice
  }, [playSomaliVoice])

  useEffect(() => {
    void loadSomaliVoiceManifest()
  }, [])

  useEffect(() => {
    if (!ayahMenu?.verseKey) {
      setSomaliVoiceAvailable(false)
      return
    }
    let cancelled = false
    void hasSomaliVoiceForVerse(ayahMenu.verseKey).then((ok) => {
      if (!cancelled) setSomaliVoiceAvailable(ok)
    })
    return () => {
      cancelled = true
    }
  }, [ayahMenu?.verseKey])

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
      stopSomaliVoice()
      somaliAutoRef.current = false
      setSomaliAutoPlaying(false)

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
    [
      currentPage,
      fetchVersesForPage,
      loadPage,
      pageSlide,
      showTranslation,
      stopRecitation,
      stopSomaliVoice,
      verticalPages,
    ]
  )

  useEffect(() => {
    getChapters().then(setChapters).catch(() => {})
    const settings = getAppSettings()
    if (!isOfflineReady()) {
      import('@/lib/local-quran-store').then(({ hydrateOfflineFromDisk }) => {
        hydrateOfflineFromDisk().catch(() => {
          if (!settings.offlineDownloaded) return
        })
      })
    }
  }, [])

  useEffect(() => {
    if (initialLoadDone.current) return
    initialLoadDone.current = true
    void (async () => {
      const { ensureOfflineHydrated } = await import('@/lib/local-quran-store')
      await ensureOfflineHydrated().catch(() => {})
      const saved =
        initialPage > 0
          ? initialPage
          : typeof window !== 'undefined'
            ? Number(localStorage.getItem(LAST_READ_PAGE_KEY) || '1')
            : 1
      await loadPage(clampPage(saved || 1))
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPage])

  const goToSurah = async (surahId: number) => {
    stopRecitation()
    setDrawerOpen(false)
    setSearchOpen(false)
    setLoadError(null)
    try {
      const verses = await getVersesByChapter(surahId)
      const first = verses[0]
      if (!first) return
      const page = await getVisualPageForVerse(first.verse_key, first.page_number || 1)
      await loadPage(page)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not open surah'
      setLoadError(message)
    }
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
  const chapterNamesById = useMemo(
    () => Object.fromEntries(chapters.map((c) => [c.id, c.name || c.englishName])),
    [chapters]
  )
  const surahTitle =
    chapters.find((c) => c.id === currentSurahNum)?.englishName || `Surah ${currentSurahNum}`
  const juzPart = juzForChapter(currentSurahNum)
  const highlightedVerseKey = recitation.highlightedVerseKey ?? somaliVoiceState.verseKey

  const handleRecitationToggle = () => {
    if (isActive) {
      stopRecitation()
      return
    }
    somaliAutoRef.current = false
    setSomaliAutoPlaying(false)
    stopSomaliVoice()
    setUiVisible(true)
    startRecitation()
  }

  const handleSomaliPageToggle = async () => {
    if (somaliAutoPlaying || isSomaliVoiceActive) {
      somaliAutoRef.current = false
      setSomaliAutoPlaying(false)
      stopSomaliVoice()
      return
    }

    stopRecitation()
    const firstVerseKey = await findNextSomaliVerse(null)
    if (!firstVerseKey) {
      setSomaliNotice(TAFSIR_UNAVAILABLE_MESSAGE)
      return
    }

    setSomaliNotice(null)
    somaliAutoRef.current = true
    setSomaliAutoPlaying(true)
    await playSomaliVoice(firstVerseKey)
  }

  useEffect(() => {
    if (!somaliAutoPlaying || !somaliVoiceState.error) return
    somaliAutoRef.current = false
    setSomaliAutoPlaying(false)
    setSomaliNotice(somaliVoiceState.error)
  }, [somaliAutoPlaying, somaliVoiceState.error])

  useEffect(() => {
    somaliAutoRef.current = false
    setSomaliAutoPlaying(false)
    stopSomaliVoice()
  }, [currentPage, stopSomaliVoice])

  const handleAyahLongPress = useCallback(
    (verseKey: string) => {
      longPressBlockTap.current = true
      stopRecitation()
      const verse = pageVerses.find((v) => v.verse_key === verseKey)
      if (!verse) return
      setAyahMenu({
        verseKey,
        arabic: getVerseArabicText(verse),
      })
      setAyahMenuBookmarked(isBookmarked(verseKey))
    },
    [pageVerses, stopRecitation]
  )

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
    setAyahMenu({ verseKey: next.verse_key, arabic: getVerseArabicText(next) })
    setAyahMenuBookmarked(isBookmarked(next.verse_key))
    if (isActive) playVerse(next.verse_key)
  }, [ayahMenu, getNextVerseOnPage, isActive, playVerse])

  const handleToggleBookmark = useCallback(() => {
    if (!ayahMenu) return
    const verse = pageVerses.find((v) => v.verse_key === ayahMenu.verseKey)
    const [surahRaw, ayahRaw] = ayahMenu.verseKey.split(':')
    const surahId = Number(surahRaw) || 1
    const ayah = Number(ayahRaw) || 1
    const surahName = chapters.find((c) => c.id === surahId)?.englishName || `Surah ${surahId}`
    const saved = toggleBookmark({
      verseKey: ayahMenu.verseKey,
      surahName,
      ayah,
      page: currentPage,
      arabic: verse ? getVerseArabicText(verse) : ayahMenu.arabic,
      createdAt: Date.now(),
    })
    setAyahMenuBookmarked(saved)
  }, [ayahMenu, chapters, currentPage, pageVerses])

  const ayahMenuHasNext = ayahMenu ? Boolean(getNextVerseOnPage(ayahMenu.verseKey)) : false

  const mushafSelectedVerseKey = ayahMenu?.verseKey ?? null

  const renderMushafPage = useCallback(
    (verses: Verse[], pageNum: number) => {
      const keys = new Set(verses.map((v) => v.verse_key))
      const start = verses[0]?.verse_key || ''
      return (
        <QuranPageView
          key={pageNum}
          verses={verses}
          chapterNamesById={chapterNamesById}
          startVerseKey={start}
          revealableVerseKeys={keys}
          revealedAyahs={keys}
          onReveal={() => {}}
          readOnly
          readMode
          pageNumber={pageNum}
          highlightedVerseKey={highlightedVerseKey}
          selectedVerseKey={mushafSelectedVerseKey}
          onAyahLongPress={handleAyahLongPress}
        />
      )
    },
    [chapterNamesById, handleAyahLongPress, highlightedVerseKey, mushafSelectedVerseKey]
  )

  const toggleUi = () => setUiVisible((v) => !v)

  const goNextPage = useCallback(() => {
    if (currentPage < TOTAL_MUSHAF_PAGES) void navigatePage(currentPage + 1)
  }, [currentPage, navigatePage])

  const goPrevPage = useCallback(() => {
    if (currentPage > 1) void navigatePage(currentPage - 1)
  }, [currentPage, navigatePage])

  const mushafSwipe = useSwipe(
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

  const handleTranslationTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0]
    translationTouchStart.current = { x: touch.clientX, y: touch.clientY }
  }

  const handleTranslationTouchEnd = (e: TouchEvent<HTMLDivElement>) => {
    const touch = e.changedTouches[0]
    const dx = touch.clientX - translationTouchStart.current.x
    const dy = touch.clientY - translationTouchStart.current.y
    const absX = Math.abs(dx)
    const absY = Math.abs(dy)
    const threshold = 56

    if (absX >= threshold && absX > absY) {
      didSwipe.current = true
      if (dx < 0) goNextPage()
      else goPrevPage()
      return
    }

    if (!verticalPages || absY < threshold || absY <= absX) return

    const el = contentScrollRef.current
    if (!el) return
    const atTop = el.scrollTop <= 2
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 2

    if (dy < 0 && atBottom) {
      didSwipe.current = true
      goNextPage()
    } else if (dy > 0 && atTop) {
      didSwipe.current = true
      goPrevPage()
    }
  }

  const contentSwipe = showTranslation
    ? { onTouchStart: handleTranslationTouchStart, onTouchEnd: handleTranslationTouchEnd }
    : mushafSwipe

  useEffect(() => {
    if (!showTranslation) return
    contentScrollRef.current?.scrollTo({ top: 0, behavior: 'auto' })
  }, [currentPage, showTranslation])

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
        <Link
          href="/settings"
          onClick={() => setSettingsReturnTo(`/read?page=${currentPage}`)}
          className="text-sm text-[var(--app-muted)] underline"
        >
          Download offline in Settings
        </Link>
      </main>
    )
  }

  return (
    <main className="mushaf-reader-immersive relative flex h-[100dvh] flex-col overflow-hidden">
      <MushafFontPreload />
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
        <span className="text-sm text-[var(--mushaf-read-meta)]">Juz {juzPart}</span>
      </div>

      {/* Mushaf body — fixed fit when reading; scroll when translation */}
      <div
        ref={contentScrollRef}
        className={cn(
          'relative min-h-0 flex-1',
          showTranslation
            ? 'overflow-y-auto overscroll-contain px-4 pb-36'
            : 'overflow-x-clip overflow-y-hidden px-1 pb-14 sm:px-2'
        )}
        onClick={handleContentTap}
        onTouchStart={pageSlide ? undefined : contentSwipe.onTouchStart}
        onTouchEnd={pageSlide ? undefined : contentSwipe.onTouchEnd}
        role="presentation"
      >
        {showTranslation ? (
          <MushafTranslationView
            verses={pageVerses}
            page={currentPage}
            chapters={chapters}
            translationLanguage={translationLanguage}
            highlightedVerseKey={highlightedVerseKey}
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
            chapterNamesById={chapterNamesById}
            startVerseKey={startVerseKey}
            revealableVerseKeys={pageVerseKeys}
            revealedAyahs={pageVerseKeys}
            onReveal={() => {}}
            readOnly
            readMode
            pageNumber={currentPage}
            highlightedVerseKey={highlightedVerseKey}
            selectedVerseKey={mushafSelectedVerseKey}
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
          <Link
            href="/settings"
            className="rounded-lg p-2 text-teal-600 hover:bg-black/5 dark:text-teal-400 dark:hover:bg-white/5"
            aria-label="Settings"
            onClick={(e) => {
              e.stopPropagation()
              setSettingsReturnTo(`/read?page=${currentPage}`)
            }}
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
        {somaliNotice ? (
          <p className="mx-auto max-w-lg rounded-lg border border-amber-500/35 bg-amber-500/15 px-3 py-2 text-center text-xs font-medium text-amber-950 dark:text-amber-100">
            {somaliNotice}
          </p>
        ) : null}
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#1a1a1a]/95 px-4 py-3 backdrop-blur">
          <button
            type="button"
            onClick={() => {
              setSomaliNotice(null)
              void handleSomaliPageToggle()
            }}
            disabled={pageVerses.length === 0}
            className={cn(
              'flex h-10 shrink-0 items-center gap-2 rounded-full px-3 text-xs font-semibold transition-colors disabled:opacity-40',
              somaliAutoPlaying || isSomaliVoiceActive
                ? 'bg-teal-500/20 text-teal-300'
                : 'text-teal-400 hover:bg-white/5'
            )}
            aria-label={somaliAutoPlaying || isSomaliVoiceActive ? 'Stop Somali voice' : 'Play Somali voice'}
          >
            {somaliVoiceState.loading ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-teal-400/30 border-t-teal-400" />
            ) : somaliAutoPlaying || isSomaliVoiceActive ? (
              <Square className="h-4 w-4 fill-current" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
            <span>Somali</span>
          </button>
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
              stopSomaliVoice()
              somaliAutoRef.current = false
              setSomaliAutoPlaying(false)
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
        isBookmarked={ayahMenuBookmarked}
        somaliVoiceAvailable={somaliVoiceAvailable}
        isSomaliVoicePlaying={
          isSomaliVoiceActive && somaliVoiceState.verseKey === ayahMenu?.verseKey
        }
        onClose={() => {
          stopSomaliVoice()
          setAyahMenu(null)
        }}
        onPlay={() => {
          if (!ayahMenu) return
          stopSomaliVoice()
          const key = ayahMenu.verseKey
          setUiVisible(false)
          setAyahMenu(null)
          playVerse(key, { continueOnPage: true })
        }}
        onToggleBookmark={handleToggleBookmark}
        onPlaySomaliVoice={() => {
          if (!ayahMenu) return
          stopRecitation()
          setSomaliNotice(null)
          void playSomaliVoice(ayahMenu.verseKey)
        }}
        onStopSomaliVoice={stopSomaliVoice}
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
