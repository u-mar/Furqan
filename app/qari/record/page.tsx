'use client'

import Link from 'next/link'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  AudioLines,
  Check,
  ChevronLeft,
  Globe,
  Hash,
  Lock,
  MicVocal,
  Pause,
  Play,
  RotateCcw,
  Send,
  Share2,
  UserRound,
  X,
} from 'lucide-react'
import Dropdown from '@/components/qari/Dropdown'
import ShareSheet from '@/components/qari/ShareSheet'
import Switch from '@/components/qari/Switch'
import Waveform from '@/components/qari/Waveform'
import { Notice, useNotice, useViewer } from '@/components/qari/QariShell'
import AccountSheet from '@/components/settings/AccountSheet'
import {
  microphoneError,
  prepareRecording,
  releasePrepared,
  useQariRecorder,
  type PreparedRecording,
} from '@/hooks/useQariRecorder'
import { createSpaceMixer, findSpace, SPACES, type SpaceId, type SpaceMixer } from '@/lib/audio-space'
import { strongFeedback, successFeedback, tapFeedback } from '@/lib/haptics'
import {
  formatDuration,
  primeRecitationAudio,
  publishRecitation,
  tidyHashtags,
  type Recitation,
} from '@/lib/qari'
import { measurePeaks } from '@/lib/qari-waveform'
import { findSheikh, SHEIKHS } from '@/lib/sheikhs'
import { cn } from '@/lib/cn'

type Step = 'ready' | 'countdown' | 'recording' | 'review' | 'published'

const MAX_SECONDS = 600
const LIVE_BARS = 34

function clock(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function RecordFlow() {
  const params = useSearchParams()
  const viewer = useViewer()
  const { notice, setNotice } = useNotice()
  const recorder = useQariRecorder(MAX_SECONDS)
  const { state } = recorder

  // Arriving from a sheikh's page ("Imitate Sheikh Sufi") switches Imitate on.
  const preset = findSheikh(params.get('imitate'))
  const [spaceId, setSpaceId] = useState<SpaceId>('reciter')
  const [imitate, setImitate] = useState(Boolean(preset))
  const [sheikhId, setSheikhId] = useState(preset?.id ?? SHEIKHS[0].id)

  const [step, setStep] = useState<Step>('ready')
  const [count, setCount] = useState(3)
  const preparedRef = useRef<PreparedRecording | null>(null)
  const countdownRef = useRef<number | null>(null)
  const [discardArmed, setDiscardArmed] = useState(false)

  const [levels, setLevels] = useState<number[]>([])

  const [peaks, setPeaks] = useState<number[]>([])
  const [title, setTitle] = useState('')
  const [hashtags, setHashtags] = useState('')
  const [caption, setCaption] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [published, setPublished] = useState<Recitation | null>(null)
  const [shareOpen, setShareOpen] = useState(false)

  const sheikh = findSheikh(sheikhId)
  const space = findSpace(spaceId)

  /* ---------------------------------------------------------- countdown */

  const clearCountdown = useCallback(() => {
    if (countdownRef.current) window.clearInterval(countdownRef.current)
    countdownRef.current = null
  }, [])

  useEffect(() => {
    return () => {
      clearCountdown()
      releasePrepared(preparedRef.current)
    }
  }, [clearCountdown])

  const begin = useCallback(async () => {
    if (!recorder.supported) {
      setNotice('This browser cannot record audio. Try Chrome on Android, or Safari on iPhone.')
      return
    }
    strongFeedback()
    setStep('countdown')
    setCount(3)
    try {
      preparedRef.current = await prepareRecording()
    } catch (err) {
      setStep('ready')
      setNotice(microphoneError(err))
      return
    }

    let remaining = 3
    countdownRef.current = window.setInterval(() => {
      remaining -= 1
      if (remaining > 0) {
        strongFeedback()
        setCount(remaining)
        return
      }
      clearCountdown()
      strongFeedback()
      setLevels([])
      setStep('recording')
      const prepared = preparedRef.current
      preparedRef.current = null
      void recorder.start(prepared ?? undefined)
    }, 850)
  }, [clearCountdown, recorder, setNotice])

  const cancelCountdown = useCallback(() => {
    clearCountdown()
    releasePrepared(preparedRef.current)
    preparedRef.current = null
    setStep('ready')
  }, [clearCountdown])

  /* ---------------------------------------------------------- recording */

  // Sample the level on a steady beat, so the waveform keeps moving even
  // through a held note that does not change the level at all.
  const levelRef = useRef(0)
  levelRef.current = state.level
  useEffect(() => {
    if (!state.recording) return
    const id = window.setInterval(() => {
      setLevels((prev) => [...prev.slice(-(LIVE_BARS - 1)), levelRef.current])
    }, 90)
    return () => window.clearInterval(id)
  }, [state.recording])

  // A failure to start drops back to the start, saying why.
  useEffect(() => {
    if (state.error && step === 'recording') {
      setStep('ready')
      setNotice(state.error)
    }
  }, [setNotice, state.error, step])

  // When the take lands, move on to publishing and measure its shape.
  useEffect(() => {
    if (!state.blob || step !== 'recording') return
    strongFeedback()
    setStep('review')
    setPeaks([])
    measurePeaks(state.blob)
      .then(setPeaks)
      .catch(() => setPeaks([]))
  }, [state.blob, step])

  useEffect(() => {
    if (!discardArmed) return
    const id = window.setTimeout(() => setDiscardArmed(false), 2500)
    return () => window.clearTimeout(id)
  }, [discardArmed])

  /* ---------------------------------------------------------- listen back */

  const previewRef = useRef<HTMLAudioElement | null>(null)
  const previewCtxRef = useRef<AudioContext | null>(null)
  const mixerRef = useRef<SpaceMixer | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [previewProgress, setPreviewProgress] = useState(0)

  /* Changing the sound takes effect at once, even mid-playback. */
  useEffect(() => {
    mixerRef.current?.setSpace(findSpace(spaceId))
  }, [spaceId])

  const stopPreview = useCallback(() => {
    previewRef.current?.pause()
    if (previewRef.current?.src) URL.revokeObjectURL(previewRef.current.src)
    previewRef.current = null
    mixerRef.current = null
    void previewCtxRef.current?.close().catch(() => {})
    previewCtxRef.current = null
    setPreviewing(false)
    setPreviewProgress(0)
  }, [])

  useEffect(() => stopPreview, [stopPreview])

  const togglePreview = useCallback(() => {
    if (!state.blob) return
    tapFeedback()
    if (previewing) {
      previewRef.current?.pause()
      return
    }
    if (!previewRef.current) {
      const audio = new Audio(URL.createObjectURL(state.blob))
      audio.addEventListener('play', () => setPreviewing(true))
      audio.addEventListener('pause', () => setPreviewing(false))
      audio.addEventListener('ended', () => {
        setPreviewing(false)
        setPreviewProgress(0)
      })
      audio.addEventListener('timeupdate', () => {
        const total = Number.isFinite(audio.duration) ? audio.duration : state.durationSec
        if (total > 0) setPreviewProgress(Math.min(1, audio.currentTime / total))
      })
      previewRef.current = audio

      // Through the mixer, so this is exactly what listeners will hear.
      const ctx = new AudioContext()
      previewCtxRef.current = ctx
      const mixer = createSpaceMixer(ctx, ctx.createMediaElementSource(audio))
      mixer.output.connect(ctx.destination)
      mixer.setSpace(findSpace(spaceId))
      mixerRef.current = mixer
    }
    void previewCtxRef.current?.resume().catch(() => {})
    void previewRef.current.play().catch(() => setNotice('Could not play that back.'))
  }, [previewing, setNotice, spaceId, state.blob, state.durationSec])

  const seekPreview = useCallback(
    (fraction: number) => {
      const audio = previewRef.current
      if (!audio) return
      const total = Number.isFinite(audio.duration) ? audio.duration : state.durationSec
      audio.currentTime = fraction * total
      setPreviewProgress(fraction)
    },
    [state.durationSec]
  )

  const recordAgain = useCallback(() => {
    tapFeedback()
    stopPreview()
    recorder.reset()
    setPeaks([])
    setStep('ready')
  }, [recorder, stopPreview])

  /* ---------------------------------------------------------- publish */

  const tags = useMemo(() => tidyHashtags(hashtags), [hashtags])

  const handlePublish = useCallback(async () => {
    if (!state.blob) return
    if (!viewer) {
      setAccountOpen(true)
      return
    }
    if (!title.trim()) {
      setNotice('Give your recitation a title.')
      document.getElementById('qari-title')?.focus()
      return
    }

    setPublishing(true)
    stopPreview()
    try {
      const imitating = imitate ? sheikhId : ''
      const id = await publishRecitation({
        blob: state.blob,
        mimeType: state.mimeType,
        durationSec: state.durationSec,
        title: title.trim(),
        space: spaceId,
        hashtags: hashtags.trim(),
        isPrivate,
        caption: caption.trim(),
        imitating,
        peaks,
        userId: viewer.id,
        userName: viewer.name,
        userUsername: viewer.username,
      })
      primeRecitationAudio(id, state.blob)
      setPublished({
        id,
        userName: viewer.name,
        userUsername: viewer.username,
        title: title.trim(),
        space: spaceId,
        hashtags: tags,
        isPrivate,
        imitating: imitating || null,
        peaks,
        caption: caption.trim(),
        durationSec: state.durationSec,
        likeCount: 0,
        playCount: 0,
        createdAt: new Date().toISOString(),
        liked: false,
      })
      successFeedback()
      setStep('published')
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Could not publish.')
    } finally {
      setPublishing(false)
    }
  }, [caption, hashtags, imitate, isPrivate, peaks, setNotice, sheikhId, spaceId, state, stopPreview, tags, title, viewer])

  const startOver = useCallback(() => {
    recorder.reset()
    setPublished(null)
    setTitle('')
    setHashtags('')
    setCaption('')
    setPeaks([])
    setStep('ready')
  }, [recorder])

  /* ---------------------------------------------------------- views */

  const spaceOptions = SPACES.map((s) => ({ id: s.id, label: s.label, hint: s.hint }))
  const sheikhOptions = SHEIKHS.map((s) => ({ id: s.id, label: s.shortName, hint: s.name }))

  const settings = (
    <Group>
      <SettingRow Icon={AudioLines} label="Sound" hint="How the room sounds">
        <Dropdown variant="field" label="Sound" value={spaceId} options={spaceOptions} onChange={setSpaceId} />
      </SettingRow>
      <Divider />
      <SettingRow Icon={MicVocal} label="Imitate a sheikh" hint="Also shows on his page">
        <Switch checked={imitate} onChange={setImitate} label="Imitate a sheikh" />
      </SettingRow>
      {imitate ? (
        <>
          <Divider />
          <div className="qari-enter">
            <SettingRow Icon={UserRound} label="Sheikh">
              <Dropdown variant="field" label="Sheikh" value={sheikhId} options={sheikhOptions} onChange={setSheikhId} />
            </SettingRow>
          </div>
        </>
      ) : null}
    </Group>
  )

  if (step === 'published' && published) {
    return (
      <Screen>
        <div className="qari-step flex flex-1 flex-col items-center justify-center text-center">
          <span className="qari-done flex h-[88px] w-[88px] items-center justify-center rounded-full bg-[var(--home-sage)] text-[var(--home-ink-fg)] shadow-[0_18px_40px_-14px_color-mix(in_srgb,var(--home-sage)_60%,transparent)]">
            <Check className="h-10 w-10" strokeWidth={3} />
          </span>
          <h1 className="mt-6 text-[1.7rem] font-extrabold tracking-[-0.02em] text-[var(--home-heading)]">
            {published.isPrivate ? 'Saved to your profile' : 'Published'}
          </h1>
          <p className="mt-1.5 max-w-[30ch] text-sm leading-relaxed text-[var(--home-muted)]">
            “{published.title}”
            {published.imitating && sheikh ? ` · imitating ${sheikh.shortName}` : ''}
            {published.isPrivate ? '. Only you can hear it.' : ' is now in the Qari feed.'}
          </p>

          <div className="mt-8 flex w-full max-w-sm flex-col gap-2.5">
            <button
              type="button"
              onClick={() => setShareOpen(true)}
              className="ed-ink ed-focus qari-press flex h-[52px] items-center justify-center gap-2 rounded-full text-[15px] font-bold"
            >
              <Share2 className="h-[18px] w-[18px]" strokeWidth={2.2} />
              Share as video or audio
            </button>
            <Link
              href={`/qari/${encodeURIComponent(published.userUsername)}`}
              className="qari-press ed-focus flex h-12 items-center justify-center rounded-full border border-[var(--home-rule-strong)] text-sm font-semibold text-[var(--home-heading)]"
            >
              See it on your profile
            </Link>
            <button
              type="button"
              onClick={startOver}
              className="ed-focus h-11 text-sm font-semibold text-[var(--home-muted)] hover:text-[var(--home-heading)]"
            >
              Record another
            </button>
          </div>
        </div>
        <ShareSheet recitation={published} open={shareOpen} onClose={() => setShareOpen(false)} onNotice={setNotice} />
        <Notice message={notice} />
      </Screen>
    )
  }

  if (step === 'review' && state.blob) {
    return (
      <Screen scroll>
        <TopBar
          left={
            <IconButton label="Record again" onClick={recordAgain}>
              <ChevronLeft className="h-6 w-6" strokeWidth={2} />
            </IconButton>
          }
          center={<p className="text-base font-semibold text-[var(--home-heading)]">Publish</p>}
        />

        <div className="qari-step">
          <GroupLabel>Your recording</GroupLabel>
          <Group>
            <div className="p-3.5">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={togglePreview}
                  aria-label={previewing ? 'Pause' : 'Listen back'}
                  className="ed-ink ed-focus qari-press flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                >
                  {previewing ? (
                    <Pause key="pause" className="qari-swap h-4 w-4 fill-current" strokeWidth={0} />
                  ) : (
                    <Play key="play" className="qari-swap ml-0.5 h-4 w-4 fill-current" strokeWidth={0} />
                  )}
                </button>
                <Waveform
                  peaks={peaks}
                  seed={String(state.durationSec)}
                  progress={previewProgress}
                  onSeek={previewRef.current ? seekPreview : undefined}
                  className="h-9 min-w-0 flex-1"
                  label="Position in your recording"
                />
                <span className="shrink-0 text-xs tabular-nums text-[var(--home-muted)]">
                  {formatDuration(state.durationSec)}
                </span>
              </div>
              <button
                type="button"
                onClick={recordAgain}
                className="qari-press ed-focus mt-3 flex h-[38px] w-full items-center justify-center gap-2 rounded-full border border-[var(--home-rule-strong)] text-[13px] font-semibold text-[var(--home-heading)]"
              >
                <RotateCcw className="h-[15px] w-[15px]" strokeWidth={2.2} />
                Record again
              </button>
            </div>
          </Group>

          <GroupLabel>Details</GroupLabel>
          <Group>
            <label className="block px-3.5 py-3 focus-within:bg-[color-mix(in_srgb,var(--home-heading)_4%,transparent)]" htmlFor="qari-title">
              <span className="flex items-center justify-between text-xs font-semibold text-[var(--home-muted)]">
                Title
                <span className="font-normal tabular-nums">{title.length}/80</span>
              </span>
              <input
                id="qari-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, 80))}
                placeholder="Al-Mulk, first ten ayat"
                className="mt-1 w-full bg-transparent text-[15px] font-medium text-[var(--home-heading)] outline-none placeholder:font-normal placeholder:text-[var(--home-muted)]"
              />
            </label>
            <Divider inset="left-3.5" />
            <label className="block px-3.5 py-3 focus-within:bg-[color-mix(in_srgb,var(--home-heading)_4%,transparent)]" htmlFor="qari-tags">
              <span className="text-xs font-semibold text-[var(--home-muted)]">Hashtags</span>
              <span className="mt-1 flex items-center gap-2">
                <Hash className="h-4 w-4 shrink-0 text-[var(--home-muted)]" strokeWidth={2} aria-hidden />
                <input
                  id="qari-tags"
                  type="text"
                  value={hashtags}
                  onChange={(e) => setHashtags(e.target.value.slice(0, 200))}
                  placeholder="tajweed hifdh fajr"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className="w-full bg-transparent text-[15px] font-medium text-[var(--home-heading)] outline-none placeholder:font-normal placeholder:text-[var(--home-muted)]"
                />
              </span>
              {tags.length > 0 ? (
                <span className="mt-2 flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="qari-enter rounded-full bg-[var(--home-sage-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--home-sage)]"
                    >
                      #{tag}
                    </span>
                  ))}
                </span>
              ) : null}
            </label>
            <Divider inset="left-3.5" />
            <label className="block px-3.5 py-3 focus-within:bg-[color-mix(in_srgb,var(--home-heading)_4%,transparent)]" htmlFor="qari-caption">
              <span className="text-xs font-semibold text-[var(--home-muted)]">Note</span>
              <textarea
                id="qari-caption"
                value={caption}
                onChange={(e) => setCaption(e.target.value.slice(0, 280))}
                rows={2}
                placeholder="Anything you'd like to say about this recitation"
                className="mt-1 w-full resize-none bg-transparent text-sm leading-relaxed text-[var(--home-heading)] outline-none placeholder:text-[var(--home-muted)]"
              />
            </label>
          </Group>

          <GroupLabel>Recitation</GroupLabel>
          {settings}

          <GroupLabel>Who can hear it</GroupLabel>
          <div className="grid h-[46px] grid-cols-2 gap-1 rounded-xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] p-1" role="radiogroup" aria-label="Who can hear it">
            {(
              [
                { value: false, label: 'Everyone', Icon: Globe },
                { value: true, label: 'Only me', Icon: Lock },
              ] as const
            ).map(({ value, label, Icon }) => (
              <button
                key={label}
                type="button"
                role="radio"
                aria-checked={isPrivate === value}
                onClick={() => {
                  tapFeedback()
                  setIsPrivate(value)
                }}
                className={cn(
                  'ed-focus flex items-center justify-center gap-2 rounded-[9px] text-sm font-semibold transition-colors',
                  isPrivate === value ? 'ed-ink' : 'text-[var(--home-muted)] hover:text-[var(--home-heading)]'
                )}
              >
                <Icon className="h-[15px] w-[15px]" strokeWidth={2.2} />
                {label}
              </button>
            ))}
          </div>
          <p className="px-1 pt-2 text-xs leading-relaxed text-[var(--home-muted)]">
            {isPrivate
              ? 'Only you can hear it, on your profile.'
              : imitate && sheikh
                ? `It appears in the Qari feed and on ${sheikh.shortName}'s page.`
                : 'It appears in the Qari feed.'}
          </p>

          <button
            type="button"
            onClick={() => void handlePublish()}
            disabled={publishing}
            className="ed-ink ed-focus qari-press mt-7 flex h-[52px] w-full items-center justify-center gap-2 rounded-full text-[15px] font-bold disabled:opacity-60"
          >
            {publishing ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <Send className="h-[17px] w-[17px]" strokeWidth={2.2} />
            )}
            {publishing
              ? 'Publishing…'
              : !viewer
                ? 'Sign in to publish'
                : isPrivate
                  ? 'Save to my profile'
                  : 'Publish recitation'}
          </button>
          <p className="pb-6 pt-2.5 text-center text-xs text-[var(--home-muted)]">
            You can delete it any time from your profile.
          </p>
        </div>

        <AccountSheet open={accountOpen} onClose={() => setAccountOpen(false)} onSuccess={() => {}} />
        <Notice message={notice} />
      </Screen>
    )
  }

  const recording = step === 'recording'
  const countingDown = step === 'countdown'
  const elapsed = recording ? state.elapsed : 0
  const left = MAX_SECONDS - elapsed

  return (
    <Screen>
      <TopBar
        left={
          recording ? (
            <IconButton
              label={discardArmed ? 'Tap again to discard' : 'Discard recording'}
              onClick={() => {
                if (!discardArmed) {
                  tapFeedback()
                  setDiscardArmed(true)
                  return
                }
                setDiscardArmed(false)
                recorder.reset()
                setStep('ready')
                setNotice('Recording discarded.')
              }}
            >
              <X className="h-[22px] w-[22px]" strokeWidth={2} />
            </IconButton>
          ) : countingDown ? (
            <IconButton label="Cancel" onClick={cancelCountdown}>
              <X className="h-[22px] w-[22px]" strokeWidth={2} />
            </IconButton>
          ) : (
            <Link
              href="/qari"
              aria-label="Close"
              className="qari-press ed-focus flex h-11 w-11 items-center justify-center text-[var(--home-heading)]"
            >
              <X className="h-[22px] w-[22px]" strokeWidth={2} />
            </Link>
          )
        }
        center={
          recording ? (
            <span className="flex h-8 items-center gap-2 rounded-full bg-rose-500/15 px-3 text-[13px] font-bold text-rose-500">
              <span className="h-2 w-2 animate-pulse rounded-full bg-rose-500" />
              Recording
            </span>
          ) : (
            <p className="text-base font-semibold text-[var(--home-heading)]">New recitation</p>
          )
        }
      />

      {recording || countingDown ? (
        <p className="qari-step mt-3 text-center text-[13px] text-[var(--home-muted)]">
          {space.label} sound{imitate && sheikh ? ` · Imitating ${sheikh.shortName}` : ''}
        </p>
      ) : (
        <div className="qari-step">
          <GroupLabel>Before you start</GroupLabel>
          {settings}
        </div>
      )}

      {/* Stage */}
      <div className="flex flex-1 flex-col items-center justify-center gap-6 py-6">
        {countingDown ? (
          <>
            <span key={count} className="qari-count text-[7rem] font-extrabold leading-none tabular-nums text-[var(--home-heading)]">
              {count}
            </span>
            <p className="text-sm text-[var(--home-muted)]">Get ready…</p>
          </>
        ) : (
          <>
            <span
              className="text-[3.75rem] font-semibold leading-none tracking-[-0.03em] tabular-nums text-[var(--home-heading)]"
              aria-live="polite"
            >
              {clock(elapsed)}
            </span>
            {recording ? <LiveWave levels={levels} /> : <IdleLine />}
            <p className="text-[13px] text-[var(--home-muted)]">
              {recording
                ? left <= 60
                  ? `${left} seconds left`
                  : 'Recite now — tap the square when you finish'
                : 'Tap the button and begin reciting'}
            </p>
          </>
        )}
      </div>

      {/* Record / stop */}
      <div className="flex flex-col items-center pb-2">
        <button
          type="button"
          onClick={() => {
            if (recording) {
              recorder.stop()
            } else if (!countingDown) {
              void begin()
            }
          }}
          disabled={countingDown}
          aria-label={recording ? 'Finish recording' : 'Start recording'}
          className={cn('qari-rec ed-focus disabled:opacity-60', recording && 'is-recording')}
        >
          <span className="qari-rec__core" />
        </button>
        <p className="mt-3.5 text-xs text-[var(--home-muted)]">
          {recording ? 'Tap to finish' : 'Up to 10 minutes · a quiet room sounds best'}
        </p>
      </div>

      <Notice message={notice} />
    </Screen>
  )
}

/* ------------------------------------------------------------ pieces */

function Screen({ children, scroll = false }: { children: React.ReactNode; scroll?: boolean }) {
  return (
    <main className="relative min-h-[100dvh] w-full bg-[var(--app-bg)] text-[var(--app-text)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[40vh] bg-[var(--home-glow)]" aria-hidden />
      <div
        className={cn(
          'relative mx-auto flex w-full max-w-lg flex-col px-4 pt-[max(0.75rem,env(safe-area-inset-top))]',
          scroll ? 'pb-[max(1rem,env(safe-area-inset-bottom))]' : 'min-h-[100dvh] pb-[max(1.5rem,env(safe-area-inset-bottom))]'
        )}
      >
        {children}
      </div>
    </main>
  )
}

function TopBar({ left, center }: { left: React.ReactNode; center: React.ReactNode }) {
  return (
    <div className="-mx-1.5 flex items-center justify-between">
      {left}
      {center}
      <span className="h-11 w-11" aria-hidden />
    </div>
  )
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="qari-press ed-focus flex h-11 w-11 items-center justify-center rounded-full text-[var(--home-heading)]"
    >
      {children}
    </button>
  )
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-1 pb-2 pt-6 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-[var(--home-muted)]">
      {children}
    </p>
  )
}

function Group({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)]">{children}</div>
  )
}

function Divider({ inset = 'left-[58px]' }: { inset?: string }) {
  return (
    <div className="relative h-px">
      <span className={cn('absolute right-0 top-0 h-px bg-[var(--home-rule)]', inset)} />
    </div>
  )
}

function SettingRow({
  Icon,
  label,
  hint,
  children,
}: {
  Icon: typeof AudioLines
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-[58px] items-center gap-3 py-2.5 pl-3.5 pr-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-[color-mix(in_srgb,var(--home-heading)_7%,transparent)] text-[var(--home-heading)]">
        <Icon className="h-[17px] w-[17px]" strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold text-[var(--home-heading)]">{label}</span>
        {hint ? <span className="mt-px block truncate text-xs text-[var(--home-muted)]">{hint}</span> : null}
      </span>
      {children}
    </div>
  )
}

function IdleLine() {
  return (
    <div className="flex h-14 items-center gap-[3px]" aria-hidden>
      {Array.from({ length: 44 }, (_, i) => (
        <span key={i} className="h-[3px] w-[3px] rounded-full bg-[var(--home-rule-strong)]" />
      ))}
    </div>
  )
}

/** The take so far scrolling in from the right, towards a fixed playhead. */
function LiveWave({ levels }: { levels: number[] }) {
  const padded = [...Array.from({ length: Math.max(0, LIVE_BARS - levels.length) }, () => -1), ...levels]
  return (
    <div className="flex h-[120px] w-full max-w-[22rem] items-center" aria-hidden>
      <div className="flex h-full flex-1 items-center justify-end gap-[3px] pr-1.5">
        {padded.map((level, i) =>
          level < 0 ? (
            <span key={i} className="h-[3px] w-[3px] shrink-0 rounded-full bg-[var(--home-rule-strong)]" />
          ) : (
            <span
              key={i}
              className="w-[3px] shrink-0 rounded-full bg-[var(--home-sage)] transition-[height] duration-100"
              // Square root, so a soft voice still moves the bars visibly.
              style={{ height: `${Math.max(6, Math.min(100, Math.sqrt(level) * 120))}%` }}
            />
          )
        )}
      </div>
      <span className="h-full w-0.5 shrink-0 rounded-full bg-[var(--home-heading)]" />
      <div className="flex h-full flex-1 items-center gap-[3px] overflow-hidden pl-2">
        {Array.from({ length: 24 }, (_, i) => (
          <span key={i} className="h-[3px] w-[3px] shrink-0 rounded-full bg-[var(--home-rule-strong)]" />
        ))}
      </div>
    </div>
  )
}

export default function QariRecordPage() {
  return (
    <Suspense fallback={null}>
      <RecordFlow />
    </Suspense>
  )
}
