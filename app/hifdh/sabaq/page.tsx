'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, ChevronRight, Volume2 } from 'lucide-react'
import RecordButton, { type RecordButtonState } from '@/components/hifdh/RecordButton'
import { HifdhHeader, HifdhScreen } from '@/components/hifdh/HifdhScreen'
import SettingsSheet from '@/components/settings/SettingsSheet'
import { useArabicVoiceInput } from '@/hooks/useArabicVoiceInput'
import { useAppSettings } from '@/hooks/useAppSettings'
import { cn } from '@/lib/cn'
import { errorFeedback, successFeedback, tapFeedback } from '@/lib/haptics'
import { checkRecitation } from '@/lib/hifdh/recitation-check'
import { getChapters, getVersesByChapter } from '@/lib/quran'
import { getVerseArabicText } from '@/lib/quran-display'
import { ayahAudioUrl, getReciterById } from '@/lib/reciters'
import { errorMessage } from '@/lib/toast'
import { tr, useT } from '@/lib/i18n'
import type { Chapter, Verse } from '@/types'

type Phase = 'sheikh' | 'yours' | 'done'
type Result = 'idle' | 'checking' | 'correct' | 'incorrect'

export default function SabaqPage() {
  const t = useT()
  const { reciterId } = useAppSettings()
  const [chapters, setChapters] = useState<Chapter[] | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [chapter, setChapter] = useState<Chapter | null>(null)
  const [verses, setVerses] = useState<Verse[] | null>(null)
  const [loadError, setLoadError] = useState('')
  const [turnIndex, setTurnIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>('sheikh')
  const [result, setResult] = useState<Result>('idle')
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    void getChapters().then(setChapters)
  }, [])

  const chooseSurah = async (c: Chapter) => {
    tapFeedback()
    setPickerOpen(false)
    setChapter(c)
    setVerses(null)
    setLoadError('')
    setTurnIndex(0)
    setPhase('sheikh')
    setResult('idle')
    try {
      const v = await getVersesByChapter(c.id)
      setVerses(v)
    } catch (err) {
      setLoadError(errorMessage(err, tr('Could not load this surah.')))
    }
  }

  const currentVerse = verses?.[turnIndex] ?? null

  // Sheikh's turn: play the ayah, then hand over automatically once it ends.
  useEffect(() => {
    if (phase !== 'sheikh' || !currentVerse) return
    const audio = audioRef.current
    if (!audio) return
    const [surah, ayah] = currentVerse.verse_key.split(':').map(Number)
    audio.src = ayahAudioUrl(getReciterById(reciterId), surah, ayah)
    void audio.play().catch(() => {})
    const onEnded = () => setPhase('yours')
    audio.addEventListener('ended', onEnded)
    return () => audio.removeEventListener('ended', onEnded)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, turnIndex, currentVerse?.verse_key])

  const advance = () => {
    if (!verses) return
    const next = turnIndex + 1
    if (next >= verses.length) {
      setPhase('done')
      return
    }
    setTurnIndex(next)
    setPhase('sheikh')
    setResult('idle')
  }

  const onTranscript = (transcript: string) => {
    if (!currentVerse) return
    setResult('checking')
    const expected = getVerseArabicText(currentVerse, { omitEndMark: true })
    window.setTimeout(() => {
      const { passed } = checkRecitation(transcript, expected)
      if (passed) {
        successFeedback()
        setResult('correct')
        window.setTimeout(advance, 700)
      } else {
        errorFeedback()
        setResult('incorrect')
      }
    }, 350)
  }

  const voice = useArabicVoiceInput(onTranscript)

  const buttonState: RecordButtonState =
    voice.state === 'unsupported' ? 'unsupported' : voice.state === 'listening' ? 'listening' : result

  if (!chapter) {
    return (
      <HifdhScreen>
        <HifdhHeader title={t('Sabaq')} sub={t('Choose the surah to start from')} />
        <div className="mt-6">
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="ed-ink ed-focus fx-press flex h-12 w-full items-center justify-center rounded-full text-[0.90625rem] font-semibold"
          >
            {t('Choose starting surah')}
          </button>
        </div>

        <SettingsSheet
          open={pickerOpen}
          title={t('Choose starting surah')}
          onClose={() => setPickerOpen(false)}
        >
          {!chapters ? (
            <p className="px-2 py-8 text-center text-sm text-[var(--home-muted)]">{t('Loading surahs…')}</p>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto">
              <ul>
                {chapters.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => void chooseSurah(c)}
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
            </div>
          )}
        </SettingsSheet>
      </HifdhScreen>
    )
  }

  return (
    <HifdhScreen>
      <HifdhHeader
        title={t('Sabaq')}
        sub={t('{surah} · {current} of {total}', {
          surah: chapter.englishName,
          current: Math.min(turnIndex + 1, verses?.length ?? 1),
          total: verses?.length ?? 0,
        })}
      />

      <audio ref={audioRef} className="hidden" />

      <div className="mt-6">
        {loadError ? (
          <p className="text-center text-sm text-rose-600">{loadError}</p>
        ) : !verses || !currentVerse ? (
          <div className="space-y-3">
            <div className="h-24 animate-pulse rounded-2xl bg-[var(--home-track)]" />
          </div>
        ) : phase === 'done' ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--home-sage-soft)] text-[var(--home-sage-deep)]">
              <Check className="h-7 w-7" strokeWidth={2.4} />
            </span>
            <p className="home-serif text-[1.3rem] font-semibold text-[var(--home-heading)]">
              {t('Sabaq complete')}
            </p>
            <p className="text-[0.875rem] text-[var(--home-muted)]">
              {t('You went through all of {surah}.', { surah: chapter.englishName })}
            </p>
            <button
              type="button"
              onClick={() => {
                setChapter(null)
                setVerses(null)
              }}
              className="ed-ink ed-focus fx-press mt-2 flex h-11 items-center rounded-full px-6 text-[0.875rem] font-semibold"
            >
              {t('Choose another surah')}
            </button>
          </div>
        ) : phase === 'sheikh' ? (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <span className="flex items-center gap-1.5 rounded-full bg-[var(--home-sage-soft)] px-3 py-1 text-[0.75rem] font-semibold text-[var(--home-sage-deep)]">
              <Volume2 className="h-3.5 w-3.5" strokeWidth={2.2} />
              {t('The sheikh recites')}
            </span>
            <p className="amiri px-2 text-[1.75rem] leading-relaxed text-[var(--home-heading)]" dir="rtl">
              {getVerseArabicText(currentVerse, { omitEndMark: true })}
            </p>
            <p className="text-[0.8125rem] text-[var(--home-muted)]">{currentVerse.verse_key}</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-5 py-6 pb-28 text-center">
            <span className="rounded-full bg-[var(--home-track)] px-3 py-1 text-[0.75rem] font-semibold text-[var(--home-heading)]">
              {t('Your turn — recite ayah {ayah} from memory', { ayah: currentVerse.verse_key.split(':')[1] })}
            </span>

            {result === 'incorrect' ? (
              <div className="w-full rounded-2xl bg-[var(--home-track)] px-4 py-3.5">
                <p className="text-[0.8125rem] font-semibold text-[var(--home-muted)]">{t('That wasn\'t quite it')}</p>
                <p className="amiri mt-1.5 text-[1.375rem] leading-relaxed text-[var(--home-heading)]" dir="rtl">
                  {getVerseArabicText(currentVerse, { omitEndMark: true })}
                </p>
              </div>
            ) : (
              <div className={cn('flex h-20 items-center justify-center gap-1', result === 'checking' && 'opacity-40')} aria-hidden>
                {Array.from({ length: 24 }, (_, i) => (
                  <span key={i} className="h-[3px] w-[3px] rounded-full bg-[var(--home-rule-strong)]" />
                ))}
              </div>
            )}

            <RecordButton
              state={buttonState}
              onStart={() => {
                setResult('idle')
                voice.start()
              }}
              onStop={voice.stop}
            />

            {result === 'incorrect' ? (
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    tapFeedback()
                    setResult('idle')
                  }}
                  className="ed-focus fx-press flex h-10 items-center rounded-full border border-[var(--home-rule-strong)] px-4 text-[0.8125rem] font-semibold text-[var(--home-heading)]"
                >
                  {t('Try again')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    tapFeedback()
                    advance()
                  }}
                  className="ed-focus fx-press flex h-10 items-center rounded-full px-4 text-[0.8125rem] font-semibold text-[var(--home-muted)]"
                >
                  {t('Skip')}
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </HifdhScreen>
  )
}
