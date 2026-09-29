'use client'

import {
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type TouchEvent,
} from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  ArrowLeftRight,
  ArrowUpDown,
  Menu,
  Moon,
  ScrollText,
  Search,
  Play,
  Pause,
  MessageSquareText,
  Bookmark,
  Share2,
  Languages,
  AudioLines,
  SkipBack,
  SkipForward,
  X,
} from 'lucide-react'
import QuranPageView from '@/components/QuranPageView'
import MushafFontPreload from '@/components/mushaf/MushafFontPreload'
import SurahSearchModal from '@/components/read/SurahSearchModal'
import ContentsDrawer from '@/components/read/ContentsDrawer'
import MushafTranslationView from '@/components/read/MushafTranslationView'
import ReciterPicker from '@/components/read/ReciterPicker'
import ContinuousScrollView from '@/components/read/ContinuousScrollView'
import GallerySwipeView from '@/components/read/GallerySwipeView'
import MushafBoundaryToast from '@/components/read/MushafBoundaryToast'
import TranslationLanguagePicker from '@/components/read/TranslationLanguagePicker'
import DockAction from '@/components/read/DockAction'
import { useAppSettings } from '@/hooks/useAppSettings'
import { usePageRecitation } from '@/hooks/usePageRecitation'
import { usePageTranslations } from '@/hooks/usePageTranslations'
import { useSomaliVoicePlayback } from '@/hooks/useSomaliVoicePlayback'
import { useWakeLock } from '@/hooks/useWakeLock'
import { useHalaqaReadingTick } from '@/hooks/useHalaqaReadingTick'
import { applyThemeToDocument, getAppSettings, READING_MODES, setAppSettings, THEME_MODES } from '@/lib/app-settings'
import { isBookmarked, toggleBookmark } from '@/lib/bookmarks'
import { cn } from '@/lib/cn'
import {
  clampPage,
  juzForChapter,
  LAST_READ_PAGE_KEY,
  LAST_READ_POSITION_KEY,
  TOTAL_MUSHAF_PAGES,
} from '@/lib/mushaf'
import {
  boundaryAtPage,
  resolveBoundaryIndex,
  type MushafBoundary,
  type MushafBoundaryIndex,
} from '@/lib/mushaf-boundaries'
import {
  getChapters,
  getMushafPage,
  getVerseByKey,
  getVersesByChapter,
  getVisualPageForVerse,
} from '@/lib/quran'
import { getLocalMushafPage, isOfflineReady, prefetchMushafPages } from '@/lib/local-quran-store'
import { getVerseArabicText } from '@/lib/quran-display'
import ShareVerseSheet, { type ShareVerseTarget } from '@/components/read/ShareVerseSheet'
import { getVerseQcfGlyphs, getVerseQcfGlyphWords, versePageNumber } from '@/lib/qcf-page'
import { qcfPageFontFamily } from '@/lib/mushaf-fonts'
import {
  hasSomaliVoiceForVerse,
  loadSomaliVoiceManifest,
  TAFSIR_UNAVAILABLE_MESSAGE,
} from '@/lib/somali-voice'
import type { SomaliVoiceSegment } from '@/lib/somali-voice'
import type { Chapter, Verse } from '@/types'
import { tr, useT } from '@/lib/i18n'

/** What the dock's single Play button plays: Arabic recitation, the Somali voice, or each ayah in Arabic then Somali. */
type ReadAudioMode = 'arabic' | 'somali' | 'both'
const READ_AUDIO_MODES: ReadAudioMode[] = ['arabic', 'somali', 'both']
const AUDIO_MODE_KEY = 'nadir-read-audio-mode'
const AUDIO_MODE_LABELS: Record<ReadAudioMode, string> = {
  arabic: 'Arabic',
  somali: 'Somali',
  both: 'Ar + So',
}

function ReadPageContent() {
  const t = useT()
  const searchParams = useSearchParams()
  const initialPage = Number(searchParams.get('page') || '0')

  const [chapters, setChapters] = useState<Chapter[]>([])
  const [pageVerses, setPageVerses] = useState<Verse[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [uiVisible, setUiVisible] = useState(false)

  /* No Fullscreen API here on purpose. Driving it from the chrome worked,
     but every entry made the browser announce "press ... to exit full
     screen" over the mushaf. The manifest is `standalone`, so the phone's
     own bars are simply always present instead. */

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [showTranslation, setShowTranslation] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [pageLoading, setPageLoading] = useState(false)
  const didSwipe = useRef(false)
  const longPressBlockTap = useRef(false)
  const ayahChangeBlockTapUntilRef = useRef(0)
  const prevHighlightedVerseKeyRef = useRef<string | null>(null)
  const translationTouchStart = useRef({ x: 0, y: 0 })
  const pageVersesRef = useRef<Verse[]>([])
  const initialLoadDone = useRef(false)
  const contentScrollRef = useRef<HTMLDivElement>(null)
  const somaliAutoRef = useRef(false)
  const playSomaliVoiceRef = useRef<(verseKey: string) => Promise<boolean>>(async () => false)
  const autoContinuePlaybackRef = useRef<'recitation' | 'somali' | 'both' | null>(null)
  const resumeRecitationOnPageRef = useRef(false)
  const currentPageRef = useRef(1)
  const pageLoadSeqRef = useRef(0)
  const navigatePageRef = useRef<
    (page: number, options?: { autoContinue?: boolean }) => void | Promise<void>
  >(() => {})
  const [somaliAutoPlaying, setSomaliAutoPlaying] = useState(false)
  const [audioMode, setAudioMode] = useState<ReadAudioMode>('arabic')
  // Arabic-then-Somali sequence: which ayah it's on, and which half is playing.
  const [bothActive, setBothActive] = useState(false)
  const [bothVerseKey, setBothVerseKey] = useState<string | null>(null)
  const bothRef = useRef(false)
  const bothPhaseRef = useRef<'arabic' | 'somali'>('arabic')
  // Bumped on every start/stop so an in-flight Arabic→Somali handoff can tell it's been superseded.
  const bothSeqRef = useRef(0)
  const arabicVerseEndRef = useRef<(verseKey: string) => void>(() => {})
  const advanceBothRef = useRef<(afterVerseKey: string) => void>(() => {})
  const pauseAllRef = useRef<() => void>(() => {})

  useEffect(() => {
    try {
      const saved = localStorage.getItem(AUDIO_MODE_KEY)
      if (saved && (READ_AUDIO_MODES as string[]).includes(saved)) setAudioMode(saved as ReadAudioMode)
    } catch {
      /* storage blocked — default mode is fine */
    }
  }, [])
  const {
    reciterId,
    translationLanguage,
    translationEditionId,
    mushafWidth,
    verseWallpapersEnabled,
    readingMode,
    theme,
    tajweed,
  } = useAppSettings()

  const cycleTheme = () => {
    const next = THEME_MODES[(THEME_MODES.indexOf(theme) + 1) % THEME_MODES.length]
    setAppSettings({ theme: next })
    applyThemeToDocument(next)
  }

  const cycleReadingMode = () => {
    const next = READING_MODES[(READING_MODES.indexOf(readingMode) + 1) % READING_MODES.length]
    setAppSettings({ readingMode: next })
  }
  const [ayahMenu, setAyahMenu] = useState<{ verseKey: string; arabic: string } | null>(null)
  const [navSelectedVerseKey, setNavSelectedVerseKey] = useState<string | null>(null)
  const [ayahMenuBookmarked, setAyahMenuBookmarked] = useState(false)
  const [showAyahTranslation, setShowAyahTranslation] = useState(false)
  const [somaliNotice, setSomaliNotice] = useState<string | null>(null)
  const [shareTarget, setShareTarget] = useState<ShareVerseTarget | null>(null)
  const [boundaryIndex, setBoundaryIndex] = useState<MushafBoundaryIndex | null>(null)
  const [boundaryToast, setBoundaryToast] = useState<MushafBoundary | null>(null)
  const prevReadPageRef = useRef<number | null>(null)

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
    currentPageRef.current = page
    setPageVerses(verses)
    setCurrentPage(page)
    setLoadError(null)
    localStorage.setItem(LAST_READ_PAGE_KEY, String(page))
    if (verses[0]?.verse_key) {
      localStorage.setItem(LAST_READ_POSITION_KEY, JSON.stringify({ page, verseKey: verses[0].verse_key }))
    }
    prefetchMushafPages(page, 3)
  }, [])

  const [neighborVerses, setNeighborVerses] = useState<{
    page: number
    prev: Verse[] | null
    next: Verse[] | null
  }>({ page: 0, prev: null, next: null })

  // Pre-render the surrounding pages so a gallery-style drag can peek at
  // them immediately, with no loading gap mid-swipe.
  useEffect(() => {
    if (showTranslation) return
    let cancelled = false
    void (async () => {
      const [prev, next] = await Promise.all([
        currentPage > 1 ? fetchVersesForPage(currentPage - 1) : Promise.resolve(null),
        currentPage < TOTAL_MUSHAF_PAGES ? fetchVersesForPage(currentPage + 1) : Promise.resolve(null),
      ])
      if (cancelled) return
      setNeighborVerses({ page: currentPage, prev, next })
    })()
    return () => {
      cancelled = true
    }
  }, [currentPage, showTranslation, fetchVersesForPage])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (!isOfflineReady()) {
        const { ensureOfflineHydrated } = await import('@/lib/local-quran-store')
        await ensureOfflineHydrated().catch(() => {})
      }
      const index = await resolveBoundaryIndex()
      if (!cancelled) setBoundaryIndex(index)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!boundaryIndex || loading) return

    const prev = prevReadPageRef.current
    prevReadPageRef.current = currentPage
    if (prev === null || prev === currentPage) return

    const boundary = boundaryAtPage(boundaryIndex, currentPage)
    if (boundary) setBoundaryToast(boundary)
  }, [boundaryIndex, currentPage, loading])

  const loadPage = useCallback(
    async (page: number, options?: { silent?: boolean }) => {
      const next = clampPage(page)
      const seq = ++pageLoadSeqRef.current
      setLoadError(null)

      if (!isOfflineReady()) {
        const { ensureOfflineHydrated } = await import('@/lib/local-quran-store')
        await ensureOfflineHydrated().catch(() => {})
      }
      if (seq !== pageLoadSeqRef.current) return

      const instant = getLocalMushafPage(next)
      if (instant && instant.length > 0) {
        if (seq !== pageLoadSeqRef.current) return
        applyPage(next, instant)
        setLoading(false)
        setPageLoading(false)
        return
      }

      if (pageVersesRef.current.length === 0) setLoading(true)
      else if (!options?.silent) setPageLoading(true)

      try {
        const verses = await getMushafPage(next)
        if (seq !== pageLoadSeqRef.current) return
        applyPage(next, verses)
      } catch (err) {
        if (seq !== pageLoadSeqRef.current) return
        const message = err instanceof Error ? err.message : tr('Failed to load page')
        console.error('Failed to load page:', err)
        setLoadError(message)
      } finally {
        if (seq === pageLoadSeqRef.current) {
          setLoading(false)
          setPageLoading(false)
        }
      }
    },
    [applyPage]
  )

  const handleRecitationPageComplete = useCallback(() => {
    const page = currentPageRef.current
    if (page >= TOTAL_MUSHAF_PAGES) return
    autoContinuePlaybackRef.current = 'recitation'
    resumeRecitationOnPageRef.current = true
    void navigatePageRef.current(page + 1, { autoContinue: true })
  }, [])

  const { state: recitation, stop: stopRecitation, pause: pauseRecitation, resume: resumeRecitation, start: startRecitation, playVerse, isActive, isPaused } =
    usePageRecitation({
      reciterId,
      verses: pageVerses,
      onPageFinished: handleRecitationPageComplete,
      onSingleVerseEnd: (verseKey) => arabicVerseEndRef.current(verseKey),
      resumeOnPageChangeRef: resumeRecitationOnPageRef,
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
      if (bothRef.current) {
        advanceBothRef.current(segment.verseKey)
        return
      }
      if (!somaliAutoRef.current) return

      void (async () => {
        const nextVerseKey = await findNextSomaliVerse(segment.verseKey)
        if (nextVerseKey) {
          await playSomaliVoiceRef.current(nextVerseKey)
          return
        }

        const page = currentPageRef.current
        if (page >= TOTAL_MUSHAF_PAGES) {
          somaliAutoRef.current = false
          setSomaliAutoPlaying(false)
          return
        }

        autoContinuePlaybackRef.current = 'somali'
        void navigatePageRef.current(page + 1, { autoContinue: true })
      })()
    },
    [findNextSomaliVerse]
  )

  const {
    state: somaliVoiceState,
    playVerse: playSomaliVoice,
    pause: pauseSomaliVoice,
    resume: resumeSomaliVoice,
    stop: stopSomaliVoice,
    isActive: isSomaliVoiceActive,
  } = useSomaliVoicePlayback({ onSegmentEnd: handleSomaliSegmentEnd })

  useEffect(() => {
    playSomaliVoiceRef.current = playSomaliVoice
  }, [playSomaliVoice])

  useEffect(() => {
    void loadSomaliVoiceManifest()
  }, [])


  const arabicByKey = useMemo(
    () => Object.fromEntries(pageVerses.map((v) => [v.verse_key, v.text_uthmani])),
    [pageVerses]
  )
  const { byKey: translationByKey, loading: ayahTranslationLoading } = usePageTranslations(
    currentPage,
    // Keep fetching while the share sheet is up, even once the menu closes.
    Boolean(ayahMenu) || Boolean(shareTarget),
    pageVerses.map((v) => v.verse_key),
    arabicByKey,
    translationLanguage,
    translationEditionId
  )

  const navigatePage = useCallback(
    async (page: number, options?: { autoContinue?: boolean }) => {
      const next = clampPage(page)
      const fromPage = currentPageRef.current
      if (next === fromPage) return

      if (!options?.autoContinue) {
        stopRecitation()
        stopSomaliVoice()
        somaliAutoRef.current = false
        setSomaliAutoPlaying(false)
        bothRef.current = false
        setBothActive(false)
        setBothVerseKey(null)
        autoContinuePlaybackRef.current = null
      }

      void loadPage(next, { silent: options?.autoContinue })
    },
    [loadPage, stopRecitation, stopSomaliVoice]
  )

  useEffect(() => {
    navigatePageRef.current = navigatePage
  }, [navigatePage])

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
      const message = err instanceof Error ? err.message : tr('Could not open surah')
      setLoadError(message)
    }
  }

  const handleSelectSurah = async (surahId: number) => {
    setSearchOpen(false)
    setDrawerOpen(false)
    await goToSurah(surahId)
  }

  const goToVerse = async (verseKey: string) => {
    stopRecitation()
    setDrawerOpen(false)
    setSearchOpen(false)
    setLoadError(null)
    try {
      const verse = await getVerseByKey(verseKey)
      const page = await getVisualPageForVerse(verseKey, verse.page_number || 1)
      await loadPage(page)
      setNavSelectedVerseKey(verseKey)
    } catch (err) {
      const message = err instanceof Error ? err.message : tr('Could not open that ayah')
      setLoadError(message)
    }
  }

  const handleSelectAyah = async (verseKey: string) => {
    setSearchOpen(false)
    setDrawerOpen(false)
    await goToVerse(verseKey)
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
    chapters.find((c) => c.id === currentSurahNum)?.englishName || t('Surah {currentSurahNum}', { currentSurahNum })
  /**
   * Juz shown in the page header. Taken from the verses actually on this page
   * (`juz_number`), not from the surah — a surah can span several juz, so the
   * per-chapter lookup reported the wrong part on most pages.
   */
  const juzPart = useMemo(() => {
    const fromPage = pageVerses.find((v) => typeof v.juz_number === 'number')?.juz_number
    return fromPage ?? juzForChapter(currentSurahNum)
  }, [pageVerses, currentSurahNum])
  const highlightedVerseKey = recitation.highlightedVerseKey ?? somaliVoiceState.verseKey ?? bothVerseKey
  const playbackActive = isActive || isSomaliVoiceActive || somaliAutoPlaying || bothActive
  const audioPlaying = isActive || isSomaliVoiceActive
  const audioLoading = recitation.loading || somaliVoiceState.loading
  /** The ayah the current session (playing or paused) is on — null when nothing is queued. */
  const nowPlayingKey = bothActive
    ? bothVerseKey
    : recitation.highlightedVerseKey ?? somaliVoiceState.verseKey

  const playBothFrom = useCallback(
    (verseKey: string) => {
      bothSeqRef.current += 1
      bothRef.current = true
      bothPhaseRef.current = 'arabic'
      setBothActive(true)
      setBothVerseKey(verseKey)
      playVerse(verseKey, { continueOnPage: false })
    },
    [playVerse]
  )

  const stopAllAudio = () => {
    bothSeqRef.current += 1
    bothRef.current = false
    setBothActive(false)
    setBothVerseKey(null)
    somaliAutoRef.current = false
    setSomaliAutoPlaying(false)
    stopRecitation()
    stopSomaliVoice()
  }

  const pauseAllAudio = () => {
    if (bothRef.current) {
      if (bothPhaseRef.current === 'arabic') pauseRecitation()
      else pauseSomaliVoice()
      return
    }
    if (isActive) {
      pauseRecitation()
      return
    }
    somaliAutoRef.current = false
    setSomaliAutoPlaying(false)
    pauseSomaliVoice()
  }

  useEffect(() => {
    pauseAllRef.current = pauseAllAudio

    arabicVerseEndRef.current = (verseKey: string) => {
      if (!bothRef.current) return
      const seq = bothSeqRef.current
      void (async () => {
        if (await hasSomaliVoiceForVerse(verseKey)) {
          if (seq !== bothSeqRef.current) return
          bothPhaseRef.current = 'somali'
          if (await playSomaliVoiceRef.current(verseKey)) return
        }
        if (seq !== bothSeqRef.current) return
        advanceBothRef.current(verseKey)
      })()
    }

    advanceBothRef.current = (afterVerseKey: string) => {
      if (!bothRef.current) return
      const verses = pageVersesRef.current
      const next = verses[verses.findIndex((v) => v.verse_key === afterVerseKey) + 1]
      if (next) {
        playBothFrom(next.verse_key)
        return
      }
      if (currentPageRef.current >= TOTAL_MUSHAF_PAGES) {
        stopAllAudio()
        return
      }
      autoContinuePlaybackRef.current = 'both'
      void navigatePageRef.current(currentPageRef.current + 1, { autoContinue: true })
    }
  })

  const startAudio = async (mode: ReadAudioMode, fromVerseKey: string | null) => {
    stopAllAudio()
    setSomaliNotice(null)

    if (mode === 'arabic') {
      if (fromVerseKey) playVerse(fromVerseKey, { continueOnPage: true })
      else startRecitation()
      return
    }

    if (mode === 'both') {
      const first = fromVerseKey ?? pageVersesRef.current[0]?.verse_key
      if (first) playBothFrom(first)
      return
    }

    const verseKey = fromVerseKey
      ? (await hasSomaliVoiceForVerse(fromVerseKey))
        ? fromVerseKey
        : null
      : await findNextSomaliVerse(null)
    if (!verseKey) {
      setSomaliNotice(tr(TAFSIR_UNAVAILABLE_MESSAGE))
      return
    }
    somaliAutoRef.current = true
    setSomaliAutoPlaying(true)
    await playSomaliVoice(verseKey)
  }

  const handlePlayToggle = () => {
    const selectedKey = ayahMenu?.verseKey ?? null
    if (selectedKey && selectedKey !== nowPlayingKey) {
      void startAudio(audioMode, selectedKey)
      return
    }
    if (audioPlaying) {
      pauseAllAudio()
      return
    }
    if (bothRef.current) {
      if (bothPhaseRef.current === 'arabic') resumeRecitation()
      else void resumeSomaliVoice()
      return
    }
    if (isPaused) {
      resumeRecitation()
      return
    }
    if (somaliVoiceState.paused) {
      somaliAutoRef.current = true
      setSomaliAutoPlaying(true)
      void resumeSomaliVoice()
      return
    }
    if (!selectedKey) setUiVisible(false)
    void startAudio(audioMode, selectedKey)
  }

  /** The mode the running session was started in, which can differ from the selector after a switch. */
  const sessionMode: ReadAudioMode = bothActive
    ? 'both'
    : recitation.highlightedVerseKey
      ? 'arabic'
      : somaliVoiceState.verseKey
        ? 'somali'
        : audioMode

  const cycleAudioMode = () => {
    const next = READ_AUDIO_MODES[(READ_AUDIO_MODES.indexOf(audioMode) + 1) % READ_AUDIO_MODES.length]
    setAudioMode(next)
    try {
      localStorage.setItem(AUDIO_MODE_KEY, next)
    } catch {
      /* storage blocked — the choice just won't persist */
    }
    if (!nowPlayingKey) return
    if (audioPlaying) void startAudio(next, nowPlayingKey)
    else stopAllAudio()
  }

  const skipAyah = (delta: 1 | -1) => {
    const verseKey = nowPlayingKey
    if (!verseKey) return
    const verses = pageVersesRef.current
    const target = verses[verses.findIndex((v) => v.verse_key === verseKey) + delta]
    if (target) {
      void startAudio(sessionMode, target.verse_key)
      return
    }
    // Back past the first ayah just restarts it; forward past the last carries on to the next page.
    if (delta < 0 || currentPageRef.current >= TOTAL_MUSHAF_PAGES) {
      void startAudio(sessionMode, verseKey)
      return
    }
    const mode = sessionMode
    stopAllAudio()
    if (mode === 'arabic') {
      autoContinuePlaybackRef.current = 'recitation'
      resumeRecitationOnPageRef.current = true
    } else {
      autoContinuePlaybackRef.current = mode
    }
    void navigatePageRef.current(currentPageRef.current + 1, { autoContinue: true })
  }

  useEffect(() => {
    if (!somaliAutoPlaying || !somaliVoiceState.error) return
    somaliAutoRef.current = false
    setSomaliAutoPlaying(false)
    setSomaliNotice(somaliVoiceState.error)
  }, [somaliAutoPlaying, somaliVoiceState.error])

  useEffect(() => {
    if (autoContinuePlaybackRef.current) return
    somaliAutoRef.current = false
    setSomaliAutoPlaying(false)
    bothRef.current = false
    setBothActive(false)
    setBothVerseKey(null)
    stopSomaliVoice()
  }, [currentPage, stopSomaliVoice])

  useEffect(() => {
    const mode = autoContinuePlaybackRef.current
    if (!mode || pageVerses.length === 0) return
    autoContinuePlaybackRef.current = null

    if (mode === 'recitation') {
      return
    }

    if (mode === 'both') {
      const first = pageVerses[0]?.verse_key
      if (first) playBothFrom(first)
      return
    }

    if (mode === 'somali') {
      somaliAutoRef.current = true
      setSomaliAutoPlaying(true)
      void (async () => {
        const firstVerseKey = await findNextSomaliVerse(null)
        if (firstVerseKey) {
          await playSomaliVoiceRef.current(firstVerseKey)
          return
        }
        somaliAutoRef.current = false
        setSomaliAutoPlaying(false)
      })()
    }
  }, [currentPage, pageVerses, findNextSomaliVerse, playBothFrom])

  useWakeLock(playbackActive)
  useHalaqaReadingTick(pageVerses.length ? currentPage : 0)

  useLayoutEffect(() => {
    if (!playbackActive) {
      prevHighlightedVerseKeyRef.current = highlightedVerseKey
      return
    }
    if (!highlightedVerseKey) return
    if (prevHighlightedVerseKeyRef.current === highlightedVerseKey) return
    prevHighlightedVerseKeyRef.current = highlightedVerseKey
    ayahChangeBlockTapUntilRef.current = Date.now() + 700
    if (!showTranslation) {
      contentScrollRef.current && (contentScrollRef.current.scrollTop = 0)
      window.scrollTo(0, 0)
    }
  }, [playbackActive, highlightedVerseKey, showTranslation])

  const openAyahMenu = useCallback(
    (verseKey: string) => {
      pauseAllRef.current()
      const select = (verse: Verse) => {
        setNavSelectedVerseKey(null)
        setUiVisible(true)
        setAyahMenu({
          verseKey,
          arabic: getVerseArabicText(verse),
        })
        setAyahMenuBookmarked(isBookmarked(verseKey))
      }
      const verse = pageVerses.find((v) => v.verse_key === verseKey)
      if (verse) {
        select(verse)
        return
      }
      // In continuous scroll the ayah can sit on a neighbouring page, not the one counted as current.
      void getVerseByKey(verseKey)
        .then(select)
        .catch(() => {})
    },
    [pageVerses]
  )

  const handleAyahLongPress = useCallback(
    (verseKey: string) => {
      longPressBlockTap.current = true
      openAyahMenu(verseKey)
    },
    [openAyahMenu]
  )

  // With an ayah already selected, one tap on another moves the selection to it —
  // no need to dismiss the first. (Tapping empty space still dismisses.)
  const handleAyahSelect = useCallback(
    (verseKey: string) => {
      if (ayahMenu?.verseKey === verseKey) return
      openAyahMenu(verseKey)
    },
    [ayahMenu?.verseKey, openAyahMenu]
  )

  useEffect(() => {
    setShowAyahTranslation(false)
  }, [ayahMenu?.verseKey])

  // Playing from the ayah menu continues on to the next verse; once it does,
  // the tapped ayah is no longer "selected" — without this its highlight came
  // back the moment playback moved past it (only suppressed while reciting).
  // Only when the highlight actually moves — a highlight left over from earlier playback must
  // not cancel the selection someone has just made on another ayah.
  const lastHighlightRef = useRef(highlightedVerseKey)
  useEffect(() => {
    const moved = lastHighlightRef.current !== highlightedVerseKey
    lastHighlightRef.current = highlightedVerseKey
    if (moved && ayahMenu && highlightedVerseKey && highlightedVerseKey !== ayahMenu.verseKey) {
      setAyahMenu(null)
    }
  }, [ayahMenu, highlightedVerseKey])

  const handleToggleBookmark = useCallback(() => {
    if (!ayahMenu) return
    const verse = pageVerses.find((v) => v.verse_key === ayahMenu.verseKey)
    const [surahRaw, ayahRaw] = ayahMenu.verseKey.split(':')
    const surahId = Number(surahRaw) || 1
    const ayah = Number(ayahRaw) || 1
    const surahName = chapters.find((c) => c.id === surahId)?.englishName || tr('Surah {surahId}', { surahId })
    const qcfGlyphs = verse ? getVerseQcfGlyphs(verse, currentPage) : ''
    const saved = toggleBookmark({
      verseKey: ayahMenu.verseKey,
      surahName,
      ayah,
      page: currentPage,
      arabic: verse ? getVerseArabicText(verse) : ayahMenu.arabic,
      ...(qcfGlyphs ? { qcfGlyphs, qcfFontFamily: qcfPageFontFamily(currentPage) } : {}),
      createdAt: Date.now(),
    })
    setAyahMenuBookmarked(saved)
  }, [ayahMenu, chapters, currentPage, pageVerses])

  const handleShareVerse = useCallback(() => {
    if (!ayahMenu) return
    const verseKey = ayahMenu.verseKey
    const surahId = Number(verseKey.split(':')[0]) || 1
    const verse = pageVerses.find((v) => v.verse_key === verseKey)
    const page = verse ? versePageNumber(verse) : currentPage

    // The ayah end mark is dropped either way — the reference is on the card.
    const plainWords = verse
      ? (verse.words || [])
          .filter((w) => w.char_type_name === 'word')
          .map((w) => (w.text_uthmani || w.text_qpc_hafs || '').trim())
          .filter(Boolean)
      : ayahMenu.arabic.split(/\s+/).filter(Boolean)

    setShareTarget({
      verseKey,
      surahName: chapters.find((c) => c.id === surahId)?.englishName || tr('Surah {surahId}', { surahId }),
      page,
      qcfWords: verse ? getVerseQcfGlyphWords(verse, page).slice(0, plainWords.length) : [],
      plainWords,
    })
  }, [ayahMenu, chapters, currentPage, pageVerses])

  const mushafSelectedVerseKey = ayahMenu?.verseKey ?? navSelectedVerseKey

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
          scrollable={readingMode === 'continuous'}
          pageNumber={pageNum}
          highlightedVerseKey={highlightedVerseKey}
          selectedVerseKey={mushafSelectedVerseKey}
          onAyahLongPress={handleAyahLongPress}
          onAyahSelect={handleAyahSelect}
          ayahSelectMode={Boolean(ayahMenu)}
          suppressHighlightScroll
          tajweed={tajweed}
        />
      )
    },
    [
      ayahMenu,
      chapterNamesById,
      handleAyahLongPress,
      handleAyahSelect,
      highlightedVerseKey,
      mushafSelectedVerseKey,
      readingMode,
      tajweed,
    ]
  )

  const toggleUi = () => setUiVisible((v) => !v)
  const chromeAnimates = !playbackActive

  const goNextPage = useCallback(() => {
    const page = currentPageRef.current
    if (page < TOTAL_MUSHAF_PAGES) void navigatePage(page + 1)
    setNavSelectedVerseKey(null)
  }, [navigatePage])

  const goPrevPage = useCallback(() => {
    const page = currentPageRef.current
    if (page > 1) void navigatePage(page - 1)
    setNavSelectedVerseKey(null)
  }, [navigatePage])

  const handleGoToPageFromDrawer = useCallback(
    (page: number, verseKey?: string) => {
      void navigatePage(page)
      setNavSelectedVerseKey(verseKey ?? null)
    },
    [navigatePage]
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
      if (dx < 0) goPrevPage()
      else goNextPage()
      return
    }

    if (readingMode === 'horizontal' || absY < threshold || absY <= absX) return

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

  const contentSwipe = { onTouchStart: handleTranslationTouchStart, onTouchEnd: handleTranslationTouchEnd }

  useLayoutEffect(() => {
    if (showTranslation) {
      contentScrollRef.current?.scrollTo({ top: 0, behavior: 'auto' })
      return
    }
    const el = contentScrollRef.current
    if (el) el.scrollTop = 0
    window.scrollTo(0, 0)
  }, [currentPage, showTranslation])

  useEffect(() => {
    if (showTranslation) return
    const html = document.documentElement
    const body = document.body
    const prevHtml = html.style.overflow
    const prevBody = body.style.overflow
    html.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    window.scrollTo(0, 0)
    return () => {
      html.style.overflow = prevHtml
      body.style.overflow = prevBody
    }
  }, [showTranslation])

  useEffect(() => {
    if (showTranslation) return
    const el = contentScrollRef.current
    if (!el) return
    const lockScroll = () => {
      if (el.scrollTop !== 0) el.scrollTop = 0
    }
    el.addEventListener('scroll', lockScroll, { passive: true })
    return () => el.removeEventListener('scroll', lockScroll)
  }, [showTranslation, currentPage])

  const handleContentTap = () => {
    if (Date.now() < ayahChangeBlockTapUntilRef.current) return
    if (didSwipe.current) {
      didSwipe.current = false
      return
    }
    if (longPressBlockTap.current) {
      longPressBlockTap.current = false
      return
    }
    if (ayahMenu) {
      setAyahMenu(null)
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
          aria-label={t('Loading')}
        />
        <p className="text-sm text-stone-500">{t('Loading page…')}</p>
      </main>
    )
  }

  if (loadError && pageVerses.length === 0) {
    return (
      <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-[var(--app-bg)] px-6 text-center">
        <p className="text-sm text-red-400">{loadError}</p>
        <p className="text-xs text-stone-500">
          {t('Check your Wi‑Fi connection. The first load can take up to a minute.')}</p>
        <button
          type="button"
          onClick={() => loadPage(currentPage)}
          className="rounded-xl bg-teal-600 px-6 py-2.5 text-sm font-semibold text-white"
        >
          {t('Retry')}</button>
      </main>
    )
  }

  const nowPlaying = (() => {
    if (!nowPlayingKey) return null
    const [surahId, ayah] = nowPlayingKey.split(':').map(Number)
    const chapter = chapters.find((c) => c.id === surahId)
    return {
      surahName: chapter?.englishName || t('Surah {currentSurahNum}', { currentSurahNum: surahId }),
      ayah,
      total: chapter?.versesCount ?? 0,
    }
  })()
  // With a different ayah selected, Play means "play that one", not "pause".
  const showPauseIcon = audioPlaying && !(ayahMenu && ayahMenu.verseKey !== nowPlayingKey)

  return (
    <main className="mushaf-reader-immersive relative flex h-[100dvh] flex-col overflow-hidden">
      <MushafFontPreload />
      {pageLoading && !playbackActive && (
        <div
          className="absolute inset-x-0 top-0 z-40 h-0.5 overflow-hidden bg-teal-900/30"
          role="status"
          aria-label={t('Loading page')}
        >
          <div className="h-full w-1/3 animate-pulse bg-teal-500" />
        </div>
      )}

      <MushafBoundaryToast boundary={boundaryToast} onDismiss={() => setBoundaryToast(null)} />

      {/* Running head — fixed slot so mushaf height never jumps when chrome toggles */}
      {!uiVisible ? (
        <div className="relative z-10 shrink-0 px-5 pb-2 pt-[max(0.65rem,env(safe-area-inset-top))]">
          <div className="mushaf-running-head" dir="ltr">
            <span className="mushaf-running-head__surah mushaf-running-head__surah--text truncate">{surahTitle}</span>
            <span className="mushaf-running-head__juz">
              {t('Juz')} {juzPart}
            </span>
          </div>
        </div>
      ) : (
        <div
          className="relative z-10 shrink-0 pb-2 pt-[max(0.65rem,env(safe-area-inset-top))]"
          aria-hidden
        >
          <div className="h-[26px]" />
        </div>
      )}

      {/* Mushaf body — fixed fit when reading; scroll when translation */}
      <div
        ref={contentScrollRef}
        dir="ltr"
        className={cn(
          'relative min-h-0 flex-1',
          showTranslation
            ? 'overflow-y-auto overscroll-contain px-4 pb-36'
            : cn(
                'mushaf-read-scroll-lock overflow-hidden overscroll-none pb-4',
                mushafWidth === 'full' ? 'mushaf-width-full px-0' : 'mushaf-width-spaced px-1 sm:px-2'
              )
        )}
        onClick={handleContentTap}
        onTouchStart={!showTranslation ? undefined : contentSwipe.onTouchStart}
        onTouchEnd={!showTranslation ? undefined : contentSwipe.onTouchEnd}
        role="presentation"
      >
        {showTranslation ? (
          <MushafTranslationView
            verses={pageVerses}
            page={currentPage}
            chapters={chapters}
            translationLanguage={translationLanguage}
            translationEditionId={translationEditionId}
            highlightedVerseKey={highlightedVerseKey}
            selectedVerseKey={mushafSelectedVerseKey}
            scrollToVerseKey={navSelectedVerseKey}
            scrollContainerRef={contentScrollRef}
            followPlaybackScroll={playbackActive}
            onAyahLongPress={handleAyahLongPress}
          />
        ) : readingMode === 'continuous' ? (
          <ContinuousScrollView
            currentPage={currentPage}
            totalPages={TOTAL_MUSHAF_PAGES}
            fetchPage={fetchVersesForPage}
            renderPage={renderMushafPage}
            onPageChange={(page) => void navigatePage(page, { autoContinue: true })}
          />
        ) : (
          <GallerySwipeView
            vertical={readingMode === 'vertical'}
            pageKey={currentPage}
            current={renderMushafPage(pageVerses, currentPage)}
            prev={
              neighborVerses.page === currentPage && neighborVerses.prev
                ? renderMushafPage(neighborVerses.prev, currentPage - 1)
                : null
            }
            next={
              neighborVerses.page === currentPage && neighborVerses.next
                ? renderMushafPage(neighborVerses.next, currentPage + 1)
                : null
            }
            onCommitNext={goNextPage}
            onCommitPrev={goPrevPage}
            onDragStart={() => {
              didSwipe.current = true
            }}
          />
        )}
      </div>

      {/* Page number — pill at the bottom left of the page */}
      {!showTranslation && (
        <div
          className="pointer-events-none absolute bottom-[max(0.55rem,env(safe-area-inset-bottom))] left-5 z-10"
          dir="ltr"
          aria-hidden
        >
          <span className="mushaf-page-plate tabular-nums">{currentPage}</span>
        </div>
      )}

      {/* Expanded chrome (menu, slider) — tap screen to toggle */}
      <header
        className={cn(
          'mushaf-read-chrome-bar absolute inset-x-0 top-0 z-30 flex items-center justify-between border-b px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]',
          chromeAnimates ? 'transition-transform duration-300' : 'transition-none',
          uiVisible ? 'translate-y-0' : '-translate-y-full'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="mushaf-read-chrome-btn rounded-lg p-2"
          aria-label={t('Open contents')}
        >
          <Menu className="h-6 w-6" />
        </button>
        <div className="min-w-0 flex-1 px-2 text-center">
          <p className="mushaf-read-chrome-title truncate text-sm">{surahTitle}</p>
          <p className="mushaf-read-chrome-subtitle text-xs">{t('Juz')} {juzPart}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={openSearch}
            className="mushaf-read-chrome-btn rounded-lg p-2"
            aria-label={t('Search surah')}
          >
            <Search className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={cycleTheme}
            className="mushaf-read-chrome-btn rounded-lg p-2"
            aria-label={t('Change theme')}
          >
            <Moon className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={cycleReadingMode}
            className="mushaf-read-chrome-btn rounded-lg p-2"
            aria-label={t('Page navigation')}
          >
            {readingMode === 'horizontal' ? (
              <ArrowLeftRight className="h-5 w-5" />
            ) : readingMode === 'vertical' ? (
              <ArrowUpDown className="h-5 w-5" />
            ) : (
              <ScrollText className="h-5 w-5" />
            )}
          </button>
        </div>
      </header>

      {/* Bottom dock — notices float just above it */}
      <div
        className={cn(
          'absolute inset-x-0 bottom-0 z-30',
          chromeAnimates ? 'transition-transform duration-300' : 'transition-none',
          uiVisible ? 'translate-y-0' : 'translate-y-full'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {somaliNotice ? (
          <p className="mx-auto mb-1.5 max-w-lg rounded-lg border border-amber-500/35 bg-amber-500/15 px-3 py-2 text-center text-xs font-medium text-amber-950 dark:text-amber-100">
            {somaliNotice}
          </p>
        ) : null}

        {ayahMenu && showAyahTranslation ? (
          <div className="mushaf-read-chrome-panel mx-2.5 mb-1.5 rounded-xl px-3.5 py-2.5">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--mushaf-read-accent)]">
              {ayahMenu.verseKey}
            </p>
            <p className="max-h-[min(30vh,11.5rem)] overflow-y-auto overscroll-contain text-[13px] leading-relaxed text-[var(--mushaf-read-text)]">
              {ayahTranslationLoading
                ? t('Loading…')
                : translationByKey[ayahMenu.verseKey]?.translation || t('Translation unavailable.')}
            </p>
          </div>
        ) : null}

        <div className="mushaf-read-dock">
          {nowPlaying ? (
            <div className="mushaf-read-dock__now">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="mushaf-dock-select__caption">
                  {audioPlaying ? t('Now playing') : t('Paused')} · {t(AUDIO_MODE_LABELS[sessionMode])}
                </span>
                <span className="mushaf-read-dock__now-title">
                  <span className="truncate">{nowPlaying.surahName}</span>
                  <span className="mushaf-read-dock__now-ayah">
                    {t('Ayah {ayah}', { ayah: nowPlaying.ayah })}
                    {nowPlaying.total ? ` / ${nowPlaying.total}` : ''}
                  </span>
                </span>
              </div>
              <button
                type="button"
                onClick={stopAllAudio}
                className="mushaf-read-dock__stop"
                aria-label={t('Stop')}
              >
                <X className="h-4 w-4" strokeWidth={2.4} />
              </button>
              {nowPlaying.total ? (
                <span className="mushaf-read-dock__progress" aria-hidden>
                  <span style={{ width: `${Math.min(100, (nowPlaying.ayah / nowPlaying.total) * 100)}%` }} />
                </span>
              ) : null}
            </div>
          ) : (
            <div className="mushaf-read-dock__selectors">
              <ReciterPicker reciterId={reciterId} />
              <span className="mushaf-read-dock__divider" aria-hidden />
              <TranslationLanguagePicker language={translationLanguage} />
            </div>
          )}

          <div className="mushaf-read-dock__actions">
            <DockAction
              label={t(AUDIO_MODE_LABELS[audioMode])}
              active={audioMode !== 'arabic'}
              aria-label={`${t('Audio')}: ${t(AUDIO_MODE_LABELS[audioMode])}`}
              icon={<AudioLines className="h-[19px] w-[19px]" />}
              onClick={cycleAudioMode}
            />

            {ayahMenu ? (
              <DockAction
                label={ayahMenuBookmarked ? t('Saved') : t('Save')}
                active={ayahMenuBookmarked}
                aria-pressed={ayahMenuBookmarked}
                icon={<Bookmark className={cn('h-[18px] w-[18px]', ayahMenuBookmarked && 'fill-current')} />}
                onClick={handleToggleBookmark}
              />
            ) : (
              <DockAction
                label={t('Previous')}
                disabled={!nowPlayingKey}
                icon={<SkipBack className="h-[18px] w-[18px]" />}
                onClick={() => skipAyah(-1)}
              />
            )}

            <div className="flex flex-1 justify-center">
              <button
                type="button"
                onClick={handlePlayToggle}
                disabled={pageVerses.length === 0}
                className="mushaf-dock-play"
                aria-label={showPauseIcon ? t('Pause') : t('Play')}
              >
                {showPauseIcon && audioLoading ? (
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : showPauseIcon ? (
                  <Pause className="h-5 w-5 fill-current" />
                ) : (
                  <Play className="ml-0.5 h-5 w-5 fill-current" />
                )}
              </button>
            </div>

            {ayahMenu ? (
              <DockAction
                label={t('Meaning')}
                active={showAyahTranslation}
                aria-pressed={showAyahTranslation}
                icon={<Languages className="h-[18px] w-[18px]" />}
                onClick={() => setShowAyahTranslation((v) => !v)}
              />
            ) : (
              <DockAction
                label={t('Next')}
                disabled={!nowPlayingKey}
                icon={<SkipForward className="h-[18px] w-[18px]" />}
                onClick={() => skipAyah(1)}
              />
            )}

            {ayahMenu && verseWallpapersEnabled ? (
              <DockAction
                label={t('Share')}
                icon={<Share2 className="h-[18px] w-[18px]" />}
                onClick={handleShareVerse}
              />
            ) : null}

            <DockAction
              label={t('Translate')}
              active={showTranslation}
              aria-pressed={showTranslation}
              icon={<MessageSquareText className="h-[19px] w-[19px]" />}
              onClick={() => {
                stopAllAudio()
                setShowTranslation((v) => !v)
              }}
            />
          </div>
        </div>
      </div>

      <SurahSearchModal
        open={searchOpen}
        chapters={chapters}
        currentSurahId={currentSurahNum}
        onClose={() => setSearchOpen(false)}
        onSelectSurah={handleSelectSurah}
        onSelectAyah={handleSelectAyah}
      />

      <ContentsDrawer
        open={drawerOpen}
        chapters={chapters}
        currentSurahId={currentSurahNum}
        onClose={() => setDrawerOpen(false)}
        onSelectSurah={handleSelectSurah}
        onGoToPage={handleGoToPageFromDrawer}
      />

      <ShareVerseSheet
        open={Boolean(shareTarget)}
        target={shareTarget}
        translation={shareTarget ? translationByKey[shareTarget.verseKey]?.translation ?? null : null}
        translationLoading={ayahTranslationLoading}
        translationLanguage={translationLanguage}
        onClose={() => setShareTarget(null)}
      />

      {uiVisible && (
        <Link
          href="/"
          className="mushaf-read-chrome-panel absolute left-4 top-16 z-20 rounded-full px-3 py-1 text-xs text-[var(--mushaf-read-meta)]"
          onClick={(e) => e.stopPropagation()}
        >
          {t('Home')}</Link>
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
