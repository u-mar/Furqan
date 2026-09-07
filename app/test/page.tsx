'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ChevronLeft, Dices, Users } from 'lucide-react'
import HomeScreen from '@/components/home/HomeScreen'
import MushafFontPreload from '@/components/mushaf/MushafFontPreload'
import QuranPageView from '@/components/QuranPageView'
import {
  GradeBar,
  HintCard,
  SessionProgress,
  SessionSummary,
  type SessionResult,
} from '@/components/test/TestSessionUI'
import {
  getChapters,
  getMushafPage,
  getVersesByChapter,
  getVersesByJuz,
  getVisualPageForVerse,
  getVisualPagesForScope,
} from '@/lib/quran'
import { getVerseArabicText } from '@/lib/quran-display'
import { getAppSettings } from '@/lib/app-settings'
import { ayahCapableReciters, everyAyahAudioUrl, getReciterById } from '@/lib/reciters'
import { getStats, pickSessionVerses, recordGrade, type Grade } from '@/lib/hifdh-progress'
import { cn } from '@/lib/cn'
import type { Chapter, ScopeMode, ScopeType, Verse } from '@/types'

type Phase = 'loading' | 'testing' | 'summary'

const SESSION_SIZE = 10

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

/** Per-ayah audio needs an everyayah reciter; mp3quran only serves whole surahs. */
function ayahReciterFolder(): string {
  try {
    const reciter = getReciterById(getAppSettings().reciterId)
    if (reciter.source === 'everyayah') return reciter.folder
  } catch {
    /* fall through to the default below */
  }
  return ayahCapableReciters()[0]?.folder ?? 'Alafasy_128kbps'
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
  const isGroup = mode === 'subac'

  const [chapters, setChapters] = useState<Chapter[]>([])
  const [phase, setPhase] = useState<Phase>('loading')
  const [pageVerses, setPageVerses] = useState<Verse[]>([])
  const [scopeVerseKeys, setScopeVerseKeys] = useState<Set<string>>(new Set())
  const [currentPage, setCurrentPage] = useState(1)

  /* Session */
  const [sessionKeys, setSessionKeys] = useState<string[]>([])
  const [sessionIndex, setSessionIndex] = useState(0)
  const [results, setResults] = useState<SessionResult[]>([])
  const [startedAt, setStartedAt] = useState(() => Date.now())
  const [elapsedMs, setElapsedMs] = useState(0)
  const [dayStreak, setDayStreak] = useState(0)
  const [sessionNonce, setSessionNonce] = useState(0)

  /* Current question */
  const [promptVerseKey, setPromptVerseKey] = useState('')
  const [hintLevel, setHintLevel] = useState(0)
  const [revealed, setRevealed] = useState(false)

  /* Audio */
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    getChapters()
      .then(setChapters)
      .catch(() => {})
  }, [])

  useEffect(() => {
    return () => {
      audioRef.current?.pause()
      audioRef.current = null
    }
  }, [])

  /* ---- Build the session ---- */
  useEffect(() => {
    let cancelled = false

    async function build() {
      setPhase('loading')
      try {
        const { verses, visualPageMap } = await loadScopeVerses(
          scope,
          surah,
          juz,
          startSurah,
          endSurah
        )
        if (verses.length === 0) throw new Error('No verses in this selection.')

        // Only ayahs with a following ayah on the same page can be "continued".
        const pageToVerses = new Map<number, Verse[]>()
        for (const v of verses) {
          const page = visualPageMap[v.verse_key] || v.page_number || 1
          if (!pageToVerses.has(page)) pageToVerses.set(page, [])
          pageToVerses.get(page)!.push(v)
        }
        const candidates = verses
          .filter((v) => {
            const page = visualPageMap[v.verse_key] || v.page_number || 1
            const onPage = pageToVerses.get(page) || []
            const idx = onPage.findIndex((pv) => pv.verse_key === v.verse_key)
            return idx >= 0 && idx < onPage.length - 1
          })
          .map((v) => v.verse_key)

        const pool = candidates.length > 0 ? candidates : verses.map((v) => v.verse_key)
        const size = isGroup
          ? Math.min(participants, pool.length)
          : Math.min(SESSION_SIZE, pool.length)
        const picked = pickSessionVerses({ candidates: pool, size })

        if (cancelled) return
        setScopeVerseKeys(new Set(verses.map((v) => v.verse_key)))
        setSessionKeys(picked)
        setSessionIndex(0)
        setResults([])
        setStartedAt(Date.now())
        setElapsedMs(0)
      } catch (err) {
        console.error('Failed to build session:', err)
        if (!cancelled) setPhase('testing')
      }
    }

    void build()
    return () => {
      cancelled = true
    }
  }, [scope, surah, juz, startSurah, endSurah, participants, isGroup, sessionNonce])

  /* ---- Load the page for the current question ---- */
  useEffect(() => {
    const key = sessionKeys[sessionIndex]
    if (!key) return
    let cancelled = false

    void (async () => {
      try {
        const page = await getVisualPageForVerse(key, 1)
        const verses = await getMushafPage(page)
        if (cancelled) return
        setPageVerses(verses)
        setCurrentPage(page)
        setPromptVerseKey(key)
        setHintLevel(0)
        setRevealed(false)
        audioRef.current?.pause()
        setPlaying(false)
        setPhase('testing')
      } catch (err) {
        console.error('Failed to load question page:', err)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [sessionKeys, sessionIndex])

  /* Session timer */
  useEffect(() => {
    if (phase !== 'testing') return
    const id = window.setInterval(() => setElapsedMs(Date.now() - startedAt), 1000)
    return () => window.clearInterval(id)
  }, [phase, startedAt])

  const promptIndex = pageVerses.findIndex((v) => v.verse_key === promptVerseKey)
  const answerVerse =
    promptIndex >= 0
      ? pageVerses.slice(promptIndex + 1).find((v) => scopeVerseKeys.has(v.verse_key))
      : undefined

  const answerWords = useMemo(() => {
    if (!answerVerse) return []
    return getVerseArabicText(answerVerse, { omitEndMark: true }).split(/\s+/).filter(Boolean)
  }, [answerVerse])

  const revealedAyahs = useMemo(() => {
    const set = new Set<string>([promptVerseKey])
    if (revealed && answerVerse) set.add(answerVerse.verse_key)
    return set
  }, [promptVerseKey, revealed, answerVerse])

  const audioUrl = useMemo(() => {
    if (!answerVerse) return null
    const [s, a] = answerVerse.verse_key.split(':').map(Number)
    if (!s || !a) return null
    return everyAyahAudioUrl(ayahReciterFolder(), s, a)
  }, [answerVerse])

  const toggleAudio = useCallback(() => {
    if (!audioUrl) return
    if (playing) {
      audioRef.current?.pause()
      setPlaying(false)
      return
    }
    if (!audioRef.current) {
      audioRef.current = new Audio()
      audioRef.current.addEventListener('ended', () => setPlaying(false))
      audioRef.current.addEventListener('pause', () => setPlaying(false))
    }
    audioRef.current.src = audioUrl
    void audioRef.current.play().then(() => setPlaying(true)).catch(() => setPlaying(false))
  }, [audioUrl, playing])

  const handleGrade = useCallback(
    (grade: Grade) => {
      const key = answerVerse?.verse_key
      if (key) recordGrade(key, grade)

      const surahId = Number((key || promptVerseKey).split(':')[0]) || 1
      const surahName =
        chapters.find((c) => c.id === surahId)?.englishName || `Surah ${surahId}`

      const nextResults = [...results, { verseKey: key || promptVerseKey, surahName, grade }]
      setResults(nextResults)

      if (sessionIndex + 1 >= sessionKeys.length) {
        setElapsedMs(Date.now() - startedAt)
        setDayStreak(getStats().dayStreak)
        audioRef.current?.pause()
        setPlaying(false)
        setPhase('summary')
      } else {
        setSessionIndex(sessionIndex + 1)
      }
    },
    [answerVerse, chapters, promptVerseKey, results, sessionIndex, sessionKeys.length, startedAt]
  )

  const revealAnswer = useCallback(() => {
    setHintLevel(3)
    setRevealed(true)
  }, [])

  const restart = useCallback(() => setSessionNonce((n) => n + 1), [])

  const drillMissed = useCallback(() => {
    const missed = results.filter((r) => r.grade !== 'got').map((r) => r.verseKey)
    if (missed.length === 0) return
    setSessionKeys(missed)
    setSessionIndex(0)
    setResults([])
    setStartedAt(Date.now())
    setElapsedMs(0)
    setPhase('testing')
  }, [results])

  const currentSurahNum = Number(promptVerseKey.split(':')[0] || 1)
  const surahTitle =
    chapters.find((c) => c.id === currentSurahNum)?.englishName || `Surah ${currentSurahNum}`
  const scopeLabel =
    scope === 'juz'
      ? `Juz ${juz}`
      : scope === 'range'
        ? `Surah ${Math.min(startSurah, endSurah)}–${Math.max(startSurah, endSurah)}`
        : `Surah ${surah}`

  if (phase === 'loading') {
    return (
      <HomeScreen className="flex flex-col items-center justify-center">
        <div
          className="h-9 w-9 animate-spin rounded-full border-2 border-[var(--home-rule-strong)] border-t-[var(--home-sage-deep)]"
          role="status"
          aria-label="Loading"
        />
        <p className="mt-4 text-sm text-[var(--home-muted)]">Building your session…</p>
      </HomeScreen>
    )
  }

  if (phase === 'summary') {
    return (
      <HomeScreen className="mx-auto max-w-lg">
        <header className="mb-5 flex items-center gap-3">
          <Link
            href="/test/select"
            className="ed-focus flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--home-rule-strong)] text-[var(--home-heading)] transition-colors hover:bg-[var(--home-ink)] hover:text-[var(--home-ink-fg)]"
            aria-label="Back to test modes"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={1.75} />
          </Link>
          <div>
            <p className="ed-label">{scopeLabel}</p>
            <h1 className="home-serif mt-1 text-[1.75rem] font-medium leading-none text-[var(--home-heading)]">
              {isGroup ? 'Round complete' : 'Well done'}
            </h1>
          </div>
        </header>

        <SessionSummary
          results={results}
          elapsedMs={elapsedMs}
          dayStreak={dayStreak}
          onAgain={restart}
          onDrillWeak={drillMissed}
        />
      </HomeScreen>
    )
  }

  return (
    <HomeScreen className="mx-auto flex min-h-[100dvh] max-w-lg flex-col pb-2">
      <MushafFontPreload />

      <header className="mb-3 flex shrink-0 items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <Link
            href="/test/select"
            className="ed-focus mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--home-rule-strong)] text-[var(--home-heading)] transition-colors hover:bg-[var(--home-track)]"
            aria-label="Back to test modes"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={1.75} />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              {isGroup ? (
                <Users className="h-3.5 w-3.5 shrink-0 text-[var(--home-sage-deep)]" />
              ) : (
                <Dices className="h-3.5 w-3.5 shrink-0 text-[var(--home-sage-deep)]" />
              )}
              <p className="home-serif truncate text-[1.05rem] font-semibold text-[var(--home-heading)]">
                {isGroup ? `Person ${sessionIndex + 1}` : surahTitle}
              </p>
            </div>
            <p className="mt-0.5 truncate text-[11px] text-[var(--home-muted)]">
              {isGroup ? `${surahTitle} · ` : ''}
              {scopeLabel} · Page {currentPage}
            </p>
          </div>
        </div>
      </header>

      <SessionProgress
        index={sessionIndex}
        total={sessionKeys.length}
        results={results.map((r) => r.grade)}
      />

      <p className="mb-2 mt-3 shrink-0 text-center text-xs text-[var(--home-muted)]">
        {revealed ? 'Compare it with what you recited' : 'What comes next?'}
      </p>

      <div className="mushaf-reader-immersive relative mb-3 min-h-0 flex-1 overflow-hidden rounded-2xl bg-[var(--mushaf-read-bg)] shadow-[var(--home-card-shadow)]">
        {/* `readOnly` would switch off hifdh reveal mode and show the whole
            page, so it is deliberately not passed here. */}
        <QuranPageView
          verses={pageVerses}
          startVerseKey={promptVerseKey}
          revealableVerseKeys={
            answerVerse && !revealed ? new Set([answerVerse.verse_key]) : new Set<string>()
          }
          revealedAyahs={revealedAyahs}
          onReveal={revealAnswer}
          readMode
          hideRevealBoxes
          pageNumber={currentPage}
        />
      </div>

      <div className="shrink-0 space-y-2.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <HintCard
          level={hintLevel}
          words={answerWords}
          revealed={revealed}
          audioUrl={audioUrl}
          playing={playing}
          onHint={() => setHintLevel((l) => Math.min(l + 1, 2))}
          onReveal={revealAnswer}
          onToggleAudio={toggleAudio}
        />

        <div className={cn(!revealed && 'pointer-events-none opacity-40')}>
          <GradeBar onGrade={handleGrade} />
        </div>
      </div>
    </HomeScreen>
  )
}

export default function TestPage() {
  return (
    <Suspense
      fallback={
        <HomeScreen className="flex items-center justify-center">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-[var(--home-rule-strong)] border-t-[var(--home-sage-deep)]" />
        </HomeScreen>
      }
    >
      <TestPageContent />
    </Suspense>
  )
}
