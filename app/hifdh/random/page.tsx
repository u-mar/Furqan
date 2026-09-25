'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { BookOpen, Check, ChevronLeft, ChevronRight, ChevronsRight, Minus, Moon, Plus, SkipForward } from 'lucide-react'
import HifdhMushafReveal from '@/components/hifdh/HifdhMushafReveal'
import RecordButton, { type RecordButtonState } from '@/components/hifdh/RecordButton'
import { HifdhHeader, HifdhScreen } from '@/components/hifdh/HifdhScreen'
import SurahJuzPicker from '@/components/hifdh/SurahJuzPicker'
import { useQuranAsr } from '@/hooks/useQuranAsr'
import { isAsrModelDownloaded } from '@/lib/asr/model-cache'
import { cn } from '@/lib/cn'
import { errorFeedback, successFeedback, tapFeedback } from '@/lib/haptics'
import { checkRecitation, matchedPrefixWordCount } from '@/lib/hifdh/recitation-check'
import { getVersesByChapter, getVersesByJuz } from '@/lib/quran'
import { getVerseArabicText } from '@/lib/quran-display'
import { errorMessage } from '@/lib/toast'
import { tr, useT } from '@/lib/i18n'
import type { Verse } from '@/types'

type Scope = 'surah' | 'juz'
type Result = 'idle' | 'checking' | 'correct' | 'incorrect' | 'revealed'

/** People don't recall the Quran by verse number — they recognise an ayah and
 *  continue with what comes after it. So the test shows one ayah (the
 *  "anchor", picked with room for a next one) and asks for the ayah right
 *  after it, the same way a teacher tests memorisation. */
function pickRandomPair(verses: Verse[]): { anchor: Verse; target: Verse } | null {
  if (verses.length < 2) return null
  const i = Math.floor(Math.random() * (verses.length - 1))
  return { anchor: verses[i], target: verses[i + 1] }
}

/** The verse right after `from` in `pool`, or null at the end of the surah/juz. */
function nextVerseAfter(pool: Verse[], from: Verse): Verse | null {
  const i = pool.findIndex((v) => v.verse_key === from.verse_key)
  if (i < 0 || i + 1 >= pool.length) return null
  return pool[i + 1]
}

const MIN_FREE_MODE_COUNT = 2
const MAX_FREE_MODE_COUNT = 20
const DEFAULT_FREE_MODE_COUNT = 5

export default function RandomAyahPage() {
  const t = useT()
  const [scope, setScope] = useState<Scope>('surah')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [scopeLabel, setScopeLabel] = useState('')
  const [pool, setPool] = useState<Verse[] | null>(null)
  const [anchor, setAnchor] = useState<Verse | null>(null)
  const [target, setTarget] = useState<Verse | null>(null)
  const [loadError, setLoadError] = useState('')
  const [result, setResult] = useState<Result>('idle')
  const [revealedWords, setRevealedWords] = useState(0)
  const [wordCount, setWordCount] = useState<number | null>(null)
  // Free mode: instead of a single surprise ayah, chain through several
  // consecutive ayahs in a row — each one recited correctly advances to the
  // next, rather than jumping to a fresh random spot.
  const [freeMode, setFreeMode] = useState(false)
  const [ayahCount, setAyahCount] = useState(DEFAULT_FREE_MODE_COUNT)
  const [remaining, setRemaining] = useState(0)
  // A chunk of ASR audio can surface several new words at once (the model
  // updates every ~0.56s, not per-word) — stepping revealedWords toward the
  // new count one word at a time, instead of jumping straight to it, makes
  // the mushaf reveal read as a smooth word-by-word write rather than a
  // stutter every half-second.
  const revealTargetRef = useRef(0)
  const revealStepTimerRef = useRef<number | null>(null)

  const clearRevealStep = () => {
    if (revealStepTimerRef.current !== null) {
      window.clearTimeout(revealStepTimerRef.current)
      revealStepTimerRef.current = null
    }
    revealTargetRef.current = 0
  }

  const stepReveal = () => {
    revealStepTimerRef.current = null
    setRevealedWords((prev) => {
      if (prev >= revealTargetRef.current) return prev
      const next = prev + 1
      if (next < revealTargetRef.current) {
        revealStepTimerRef.current = window.setTimeout(stepReveal, 110)
      }
      return next
    })
  }

  useEffect(() => {
    clearRevealStep()
    setRevealedWords(0)
    setWordCount(null)
  }, [target?.verse_key])

  useEffect(() => clearRevealStep, [])

  const chooseScope = async (kind: Scope, id: number, label: string) => {
    tapFeedback()
    setPickerOpen(false)
    setLoadError('')
    setPool(null)
    setAnchor(null)
    setTarget(null)
    setResult('idle')
    setScopeLabel(label)
    try {
      const verses = kind === 'surah' ? await getVersesByChapter(id) : await getVersesByJuz(id)
      const pair = pickRandomPair(verses)
      if (!pair) throw new Error(tr('Not enough ayahs for this.'))
      setPool(verses)
      setAnchor(pair.anchor)
      setTarget(pair.target)
      setRemaining(ayahCount)
    } catch (err) {
      setLoadError(errorMessage(err, tr('Could not load that.')))
    }
  }

  const goToNextAyah = () => {
    if (!pool) return
    const pair = pickRandomPair(pool)
    if (!pair) return
    setAnchor(pair.anchor)
    setTarget(pair.target)
    setResult('idle')
    setRemaining(ayahCount)
  }

  const nextAyah = () => {
    tapFeedback()
    goToNextAyah()
  }

  const advanceInFreeMode = () => {
    if (!pool || !target) return goToNextAyah()
    const next = nextVerseAfter(pool, target)
    if (!next || remaining <= 1) {
      // Ran out of ayahs, or finished this run of `ayahCount` — jump to a
      // fresh spot and start counting down again, so free mode keeps going
      // rather than dead-ending.
      goToNextAyah()
      return
    }
    setAnchor(target)
    setTarget(next)
    setResult('idle')
    setRemaining((n) => n - 1)
  }

  const toggleFreeMode = () => {
    tapFeedback()
    setFreeMode((was) => {
      if (!was) setRemaining(ayahCount)
      return !was
    })
  }

  const changeAyahCount = (delta: number) => {
    tapFeedback()
    setAyahCount((n) => {
      const next = Math.min(MAX_FREE_MODE_COUNT, Math.max(MIN_FREE_MODE_COUNT, n + delta))
      setRemaining(next)
      return next
    })
  }

  const onTranscript = (transcript: string) => {
    if (!target) return
    setResult('checking')
    const expected = getVerseArabicText(target, { omitEndMark: true })
    window.setTimeout(() => {
      const { passed } = checkRecitation(transcript, expected)
      if (passed) {
        successFeedback()
        setResult('correct')
        window.setTimeout(freeMode ? advanceInFreeMode : goToNextAyah, 1100)
      } else {
        errorFeedback()
        setResult('incorrect')
      }
    }, 350)
  }

  // Writes the words onto the mushaf live as they're recognised, the same
  // way Tarteel highlights them while you're still reciting — matched in
  // order, so it tracks real progress through the ayah rather than jumping
  // ahead on an out-of-order guess.
  const onInterimTranscript = (transcript: string) => {
    if (!target) return
    const expected = getVerseArabicText(target, { omitEndMark: true })
    const count = matchedPrefixWordCount(transcript, expected)
    if (count <= revealTargetRef.current) return
    revealTargetRef.current = count
    if (revealStepTimerRef.current === null) stepReveal()
  }

  const voice = useQuranAsr(onTranscript, onInterimTranscript)

  const buttonState: RecordButtonState =
    voice.state === 'unsupported'
      ? 'unsupported'
      : voice.state === 'listening'
        ? 'listening'
        : result === 'revealed'
          ? 'idle'
          : result

  if (!target || !anchor) {
    return (
      <HifdhScreen>
        <HifdhHeader title={t('Surprise ayah')} sub={t('Pick a surah or juz to be tested on')} />

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => {
              tapFeedback()
              setScope('surah')
              setPickerOpen(true)
            }}
            className="home-card home-press ed-focus flex flex-col items-center gap-2 rounded-2xl px-3 py-5 text-center"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--home-sage-soft)] text-[var(--home-sage-deep)]">
              <BookOpen className="h-6 w-6" strokeWidth={1.9} />
            </span>
            <span className="text-[0.9375rem] font-semibold text-[var(--home-heading)]">{t('Surah')}</span>
            <span className="text-[0.75rem] text-[var(--home-muted)]">{t('Pick by name')}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              tapFeedback()
              setScope('juz')
              setPickerOpen(true)
            }}
            className="home-card home-press ed-focus flex flex-col items-center gap-2 rounded-2xl px-3 py-5 text-center"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--home-sage-soft)] text-[var(--home-sage-deep)]">
              <Moon className="h-6 w-6" strokeWidth={1.9} />
            </span>
            <span className="text-[0.9375rem] font-semibold text-[var(--home-heading)]">{t('Juz')}</span>
            <span className="text-[0.75rem] text-[var(--home-muted)]">{t('Pick by section')}</span>
          </button>
        </div>
        {loadError ? <p className="mt-3 text-center text-sm text-rose-600">{loadError}</p> : null}

        <SurahJuzPicker
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          title={scope === 'surah' ? t('Choose a surah') : t('Choose a juz')}
          initialTab={scope}
          onSelectSurah={(c) => void chooseScope('surah', c.id, c.englishName)}
          onSelectJuz={(j) => void chooseScope('juz', j, t('Juz {juz}', { juz: j }))}
        />
      </HifdhScreen>
    )
  }

  const fullyRevealedByHints = wordCount !== null && revealedWords >= wordCount
  const showFullText = result === 'correct' || result === 'incorrect' || result === 'revealed'

  const revealNextWord = () => {
    tapFeedback()
    setRevealedWords((n) => (wordCount !== null ? Math.min(n + 1, wordCount) : n + 1))
  }

  const revealAll = () => {
    tapFeedback()
    setResult('revealed')
  }

  // A full mushaf reader, same as /read — the page is the whole screen, not a
  // section boxed inside a normal scrolling Hifdh screen.
  return (
    <main className="mushaf-reader-immersive relative flex h-[100dvh] flex-col overflow-hidden">
      <div
        className="relative z-20 flex shrink-0 flex-col items-center gap-1.5 px-4 pb-2 pt-[max(0.65rem,env(safe-area-inset-top))]"
        dir="ltr"
      >
        <div className="flex w-full items-center gap-3">
          <Link href="/hifdh" className="home-round ed-focus shrink-0" aria-label={t('Back')}>
            <ChevronLeft className="h-5 w-5" strokeWidth={1.9} />
          </Link>
          <span className="flex-1 truncate text-center text-[0.8125rem] font-semibold text-[var(--mushaf-read-meta)]">
            {scopeLabel}
          </span>
          <span className="h-9 w-9 shrink-0" aria-hidden />
        </div>
        {voice.state === 'unsupported' && voice.error ? (
          isAsrModelDownloaded() ? (
            <p className="text-[0.75rem] font-medium text-[var(--mushaf-read-meta)]">{voice.error}</p>
          ) : (
            <Link href="/settings" className="text-[0.75rem] font-semibold text-[var(--mushaf-read-accent)] underline">
              {voice.error}
            </Link>
          )
        ) : null}
      </div>

      {result === 'incorrect' || result === 'revealed' || result === 'correct' ? (
        <div className="relative z-20 flex shrink-0 justify-center pb-2" dir="ltr">
          {result === 'incorrect' ? (
            <p className="text-[0.8125rem] font-semibold text-[var(--mushaf-read-meta)]">{t('That wasn\'t quite it')}</p>
          ) : result === 'revealed' ? (
            <p className="text-[0.8125rem] font-semibold text-[var(--mushaf-read-meta)]">{t('The ayah')}</p>
          ) : (
            <p className="flex items-center justify-center gap-1.5 text-[0.8125rem] font-semibold text-[var(--mushaf-read-accent)]">
              <Check className="h-4 w-4" strokeWidth={2.6} />
              {t('That\'s it')}
            </p>
          )}
        </div>
      ) : null}

      {/* The real printed page: the anchor ayah shows in full right where it's
          printed, every other ayah stays blank (shaped width kept, so the page's
          real line breaks and ayah markers show), and the target ayah's words
          reveal one at a time as `revealedWords` grows. */}
      <HifdhMushafReveal
        anchor={anchor}
        target={target}
        revealedWordCount={revealedWords}
        fullyRevealed={showFullText}
        onWordCount={setWordCount}
        className="relative min-h-0 flex-1 overflow-y-auto"
      />

      {result === 'correct' ? null : (
        <RecordButton
          state={buttonState}
          onStart={() => {
            setResult('idle')
            clearRevealStep()
            setRevealedWords(0)
            voice.start()
          }}
          onStop={voice.stop}
          bottomOffset="max(1rem, env(safe-area-inset-bottom))"
          leading={
            <>
              <button
                type="button"
                onClick={toggleFreeMode}
                aria-pressed={freeMode}
                aria-label={t('Free mode')}
                className={cn(
                  'ed-focus pointer-events-auto flex h-12 shrink-0 items-center rounded-full border px-2.5 text-[0.75rem] font-semibold transition-colors',
                  freeMode
                    ? 'border-[var(--mushaf-read-accent)] bg-[var(--mushaf-read-accent-soft)] text-[var(--mushaf-read-accent)]'
                    : 'border-[var(--home-rule-strong)] text-[var(--mushaf-read-meta)]'
                )}
              >
                {t('Free')}
              </button>
              {freeMode ? (
                <div className="ed-focus pointer-events-auto flex h-12 shrink-0 items-center gap-0.5 rounded-full border border-[var(--home-rule-strong)] px-1">
                  <button
                    type="button"
                    onClick={() => changeAyahCount(-1)}
                    disabled={ayahCount <= MIN_FREE_MODE_COUNT}
                    aria-label={t('Fewer ayahs')}
                    className="ed-focus flex h-7 w-7 items-center justify-center rounded-full text-[var(--mushaf-read-text)] disabled:opacity-30"
                  >
                    <Minus className="h-3.5 w-3.5" strokeWidth={2.4} />
                  </button>
                  <span className="w-4 text-center text-[0.8125rem] font-semibold tabular-nums text-[var(--mushaf-read-text)]">
                    {ayahCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => changeAyahCount(1)}
                    disabled={ayahCount >= MAX_FREE_MODE_COUNT}
                    aria-label={t('More ayahs')}
                    className="ed-focus flex h-7 w-7 items-center justify-center rounded-full text-[var(--mushaf-read-text)] disabled:opacity-30"
                  >
                    <Plus className="h-3.5 w-3.5" strokeWidth={2.4} />
                  </button>
                </div>
              ) : null}
              {!freeMode && (result === 'idle' || result === 'checking') ? (
                <>
                  <button
                    type="button"
                    onClick={revealNextWord}
                    disabled={fullyRevealedByHints}
                    aria-label={t('Show next word')}
                    className="hifdh-hint ed-focus pointer-events-auto"
                  >
                    <ChevronRight className="h-[18px] w-[18px]" strokeWidth={2.2} />
                  </button>
                  <button
                    type="button"
                    onClick={revealAll}
                    aria-label={t('Show full ayah')}
                    className="hifdh-hint ed-focus pointer-events-auto"
                  >
                    <ChevronsRight className="h-[18px] w-[18px]" strokeWidth={2.2} />
                  </button>
                </>
              ) : null}
              <button
                type="button"
                onClick={nextAyah}
                aria-label={t('Next ayah')}
                className="hifdh-hint ed-focus pointer-events-auto"
              >
                <SkipForward className="h-[18px] w-[18px]" strokeWidth={2.2} />
              </button>
            </>
          }
        />
      )}
    </main>
  )
}
