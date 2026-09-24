'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, ChevronLeft, ChevronRight, ChevronsLeft, SkipForward } from 'lucide-react'
import HifdhMushafReveal from '@/components/hifdh/HifdhMushafReveal'
import RecordButton, { type RecordButtonState } from '@/components/hifdh/RecordButton'
import { HifdhHeader, HifdhScreen } from '@/components/hifdh/HifdhScreen'
import SettingsSheet from '@/components/settings/SettingsSheet'
import { useArabicVoiceInput } from '@/hooks/useArabicVoiceInput'
import { errorFeedback, successFeedback, tapFeedback } from '@/lib/haptics'
import { checkRecitation } from '@/lib/hifdh/recitation-check'
import { getChapters, getVersesByChapter, getVersesByJuz } from '@/lib/quran'
import { getVerseArabicText } from '@/lib/quran-display'
import { errorMessage } from '@/lib/toast'
import { tr, useT } from '@/lib/i18n'
import type { Chapter, Verse } from '@/types'

type Scope = 'surah' | 'juz'
type Result = 'idle' | 'checking' | 'correct' | 'incorrect' | 'revealed'

const JUZ_LIST = Array.from({ length: 30 }, (_, i) => i + 1)

/** People don't recall the Quran by verse number — they recognise an ayah and
 *  continue with what comes after it. So the test shows one ayah (the
 *  "anchor", picked with room for a next one) and asks for the ayah right
 *  after it, the same way a teacher tests memorisation. */
function pickRandomPair(verses: Verse[]): { anchor: Verse; target: Verse } | null {
  if (verses.length < 2) return null
  const i = Math.floor(Math.random() * (verses.length - 1))
  return { anchor: verses[i], target: verses[i + 1] }
}

export default function RandomAyahPage() {
  const t = useT()
  const [chapters, setChapters] = useState<Chapter[] | null>(null)
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

  useEffect(() => {
    void getChapters().then(setChapters)
  }, [])

  useEffect(() => {
    setRevealedWords(0)
    setWordCount(null)
  }, [target?.verse_key])

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
  }

  const nextAyah = () => {
    tapFeedback()
    goToNextAyah()
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
        window.setTimeout(goToNextAyah, 1100)
      } else {
        errorFeedback()
        setResult('incorrect')
      }
    }, 350)
  }

  const voice = useArabicVoiceInput(onTranscript)

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

        <div className="mt-5 flex justify-center">
          <div role="group" aria-label={t('Scope')} className="ed-seg" style={{ gridTemplateColumns: 'repeat(2, minmax(0,1fr))' }}>
            {(['surah', 'juz'] as const).map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={scope === s}
                onClick={() => {
                  tapFeedback()
                  setScope(s)
                }}
                className="ed-seg__item ed-focus flex h-9 items-center justify-center px-4 text-[0.8125rem] font-semibold"
              >
                {s === 'surah' ? t('Surah') : t('Juz')}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="ed-ink ed-focus fx-press flex h-12 w-full items-center justify-center rounded-full text-[0.90625rem] font-semibold"
          >
            {scope === 'surah' ? t('Choose a surah') : t('Choose a juz')}
          </button>
          {loadError ? <p className="mt-3 text-center text-sm text-rose-600">{loadError}</p> : null}
        </div>

        <SettingsSheet
          open={pickerOpen}
          title={scope === 'surah' ? t('Choose a surah') : t('Choose a juz')}
          onClose={() => setPickerOpen(false)}
        >
          <div className="max-h-[60vh] overflow-y-auto">
            {scope === 'surah' ? (
              !chapters ? (
                <p className="px-2 py-8 text-center text-sm text-[var(--home-muted)]">{t('Loading surahs…')}</p>
              ) : (
                <ul>
                  {chapters.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => void chooseScope('surah', c.id, c.englishName)}
                        className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-[var(--home-track)]"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--home-track)] text-[0.8125rem] font-semibold text-[var(--home-heading)]">
                          {c.id}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[0.9375rem] font-medium text-[var(--home-heading)]">
                          {c.englishName}
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-[var(--home-muted)]" />
                      </button>
                    </li>
                  ))}
                </ul>
              )
            ) : (
              <ul className="grid grid-cols-3 gap-2 p-1">
                {JUZ_LIST.map((j) => (
                  <li key={j}>
                    <button
                      type="button"
                      onClick={() => void chooseScope('juz', j, t('Juz {juz}', { juz: j }))}
                      className="ed-focus flex h-12 w-full items-center justify-center rounded-xl bg-[var(--home-track)] text-[0.9375rem] font-semibold text-[var(--home-heading)]"
                    >
                      {j}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </SettingsSheet>
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
        className="relative z-20 flex shrink-0 items-center gap-3 px-4 pb-2 pt-[max(0.65rem,env(safe-area-inset-top))]"
        dir="ltr"
      >
        <Link href="/hifdh" className="home-round ed-focus shrink-0" aria-label={t('Back')}>
          <ChevronLeft className="h-5 w-5" strokeWidth={1.9} />
        </Link>
        <span className="mx-auto rounded-full bg-[var(--mushaf-read-badge-bg)] px-3.5 py-1.5 text-[0.8125rem] font-semibold text-[var(--mushaf-read-text)]">
          {t('Recite the next ayah from memory')}
        </span>
        <span className="h-9 w-9 shrink-0" aria-hidden />
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
            voice.start()
          }}
          onStop={voice.stop}
          bottomOffset="max(1rem, env(safe-area-inset-bottom))"
          leading={
            <>
              {result === 'idle' || result === 'checking' ? (
                <>
                  <button
                    type="button"
                    onClick={revealNextWord}
                    disabled={fullyRevealedByHints}
                    aria-label={t('Show next word')}
                    className="hifdh-hint ed-focus pointer-events-auto"
                  >
                    <ChevronLeft className="h-[18px] w-[18px]" strokeWidth={2.2} />
                  </button>
                  <button
                    type="button"
                    onClick={revealAll}
                    aria-label={t('Show full ayah')}
                    className="hifdh-hint ed-focus pointer-events-auto"
                  >
                    <ChevronsLeft className="h-[18px] w-[18px]" strokeWidth={2.2} />
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
