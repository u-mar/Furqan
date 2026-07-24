'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ChevronLeft,
  Gauge,
  Headphones,
  Loader2,
  Mic,
  Pause,
  Play,
  Repeat,
  RotateCcw,
  Sparkles,
  Square,
  Target,
  TrendingUp,
  Trophy,
} from 'lucide-react'
import HomeScreen from '@/components/home/HomeScreen'
import VoiceScoreRing from '@/components/imitate/VoiceScoreRing'
import VoiceSimilarityCard from '@/components/imitate/VoiceSimilarityCard'
import WaveformCompare from '@/components/imitate/WaveformCompare'
import { useRecitationRecorder } from '@/hooks/useRecitationRecorder'
import { getReciterById, isSurahOnlyReciter, SURAH_ONLY_RECITER_HINT } from '@/lib/reciters'
import { getPlayableAyahAudioUrl } from '@/lib/offline-audio'
import { getBestForAyah, savePracticeRecord, type SaveResult } from '@/lib/imitate-progress'
import { decodeToAudioBuffer } from '@/lib/audio-decode'
import { analyzeVoiceSimilarity, extractPeakWaveform, type VoiceSimilarityResult } from '@/lib/voice-similarity'
import type { WaveformPlaybackTrack } from '@/components/imitate/WaveformCompare'
import { cn } from '@/lib/cn'

type Phase = 'idle' | 'playing' | 'recording' | 'analyzing' | 'results'

interface PlaybackState {
  progress: number
  track: WaveformPlaybackTrack
}

interface ImitateSessionProps {
  surah: number
  ayah: number
  reciterId: string
  arabicText: string
  surahName: string
}

const SPEEDS = [0.5, 0.75, 1] as const
type Speed = (typeof SPEEDS)[number]

const STEPS = ['Listen', 'Record', 'Result'] as const

function stepIndex(phase: Phase): number {
  if (phase === 'results') return 2
  if (phase === 'recording' || phase === 'analyzing') return 1
  return 0
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase()
}

const FOCUS_COPY: Record<'tone' | 'sound' | 'flow', { title: string; body: string }> = {
  tone: {
    title: 'Focus: Melody & intonation',
    body: 'Your pitch drifts from the reciter. Hum their tune first, then match how the voice rises and falls across the ayah.',
  },
  sound: {
    title: 'Focus: Voice color',
    body: 'Your timbre differs from the reciter. Relax the throat and shape each vowel like they do — aim for the same depth and brightness.',
  },
  flow: {
    title: 'Focus: Rhythm & pauses',
    body: 'Your timing differs. Copy where the reciter breathes and how long each word is held. Slow practice locks this in.',
  },
}

/** Tiny improvement sparkline from the attempt history. */
function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null
  const w = 100
  const h = 28
  const max = Math.max(...values, 100)
  const min = Math.min(...values, 0)
  const range = Math.max(max - min, 1)
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w
    const y = h - ((v - min) / range) * (h - 4) - 2
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  const last = values[values.length - 1]
  const lastX = w
  const lastY = h - ((last - min) / range) * (h - 4) - 2
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-7 w-full" preserveAspectRatio="none" aria-hidden>
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke="var(--home-sage-deep)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={lastX} cy={lastY} r={2.4} fill="var(--home-sage-deep)" />
    </svg>
  )
}

export default function ImitateSession({
  surah,
  ayah,
  reciterId,
  arabicText,
  surahName,
}: ImitateSessionProps) {
  const reciter = getReciterById(reciterId)
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<VoiceSimilarityResult | null>(null)
  const [saveResult, setSaveResult] = useState<SaveResult | null>(null)
  const [refPreviewWaveform, setRefPreviewWaveform] = useState<number[]>([])
  const [refDurationMs, setRefDurationMs] = useState(0)
  const [playback, setPlayback] = useState<PlaybackState>({ progress: 0, track: null })
  const [speed, setSpeed] = useState<Speed>(1)
  const [loopRef, setLoopRef] = useState(false)
  const [priorBest, setPriorBest] = useState<number | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const userAudioRef = useRef<HTMLAudioElement | null>(null)
  const playbackRafRef = useRef<number | null>(null)
  const refAudioBufferRef = useRef<AudioBuffer | null>(null)
  const refObjectUrlRef = useRef<string | null>(null)
  const {
    recording,
    blob,
    level,
    error: recorderError,
    startRecording,
    stopRecording,
    clearRecording,
  } = useRecitationRecorder()

  const activeStep = stepIndex(phase)
  const surahOnly = isSurahOnlyReciter(reciter)

  useEffect(() => {
    const best = getBestForAyah(reciterId, surah, ayah)
    setPriorBest(best?.bestVoiceSimilarity ?? null)
  }, [reciterId, surah, ayah])

  const stopPlaybackTracking = useCallback(() => {
    if (playbackRafRef.current !== null) {
      cancelAnimationFrame(playbackRafRef.current)
      playbackRafRef.current = null
    }
  }, [])

  const clearPlayback = useCallback(() => {
    stopPlaybackTracking()
    setPlayback({ progress: 0, track: null })
  }, [stopPlaybackTracking])

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    if (userAudioRef.current) {
      userAudioRef.current.pause()
      userAudioRef.current = null
    }
    clearPlayback()
  }, [clearPlayback])

  const attachPlaybackTracking = useCallback(
    (audio: HTMLAudioElement, track: NonNullable<WaveformPlaybackTrack>) => {
      stopPlaybackTracking()
      setPlayback({ progress: 0, track })

      const tick = () => {
        if (audio.paused || audio.ended) return
        const progress = audio.duration > 0 ? audio.currentTime / audio.duration : 0
        setPlayback({ progress, track })
        playbackRafRef.current = requestAnimationFrame(tick)
      }

      const onPlay = () => {
        stopPlaybackTracking()
        playbackRafRef.current = requestAnimationFrame(tick)
      }

      const onEnded = () => clearPlayback()

      audio.addEventListener('play', onPlay)
      audio.addEventListener('ended', onEnded)
      audio.addEventListener('pause', () => {
        if (audio.ended) return
        stopPlaybackTracking()
        setPlayback({ progress: audio.duration > 0 ? audio.currentTime / audio.duration : 0, track })
      })

      return () => {
        audio.removeEventListener('play', onPlay)
        audio.removeEventListener('ended', onEnded)
        stopPlaybackTracking()
      }
    },
    [clearPlayback, stopPlaybackTracking]
  )

  useEffect(() => () => stopAudio(), [stopAudio])

  // Live speed changes on the currently-playing reciter track.
  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed
  }, [speed])

  useEffect(() => {
    return () => {
      if (refObjectUrlRef.current) {
        URL.revokeObjectURL(refObjectUrlRef.current)
        refObjectUrlRef.current = null
      }
    }
  }, [])

  const loadReferenceAudio = useCallback(async (): Promise<AudioBuffer> => {
    if (isSurahOnlyReciter(reciter)) {
      throw new Error(SURAH_ONLY_RECITER_HINT)
    }
    if (refAudioBufferRef.current) return refAudioBufferRef.current

    const url = await getPlayableAyahAudioUrl(reciterId, surah, ayah)
    if (!url) {
      throw new Error('No internet — connect to load reciter audio, or download the surah in Listen')
    }

    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error('fetch failed')
      const arrayBuffer = await res.arrayBuffer()
      const buffer = await decodeToAudioBuffer(arrayBuffer)
      refAudioBufferRef.current = buffer
      setRefPreviewWaveform(extractPeakWaveform(buffer, 280))
      setRefDurationMs(Math.round(buffer.duration * 1000))
      return buffer
    } finally {
      if (url.startsWith('blob:')) {
        URL.revokeObjectURL(url)
      }
    }
  }, [reciter, reciterId, surah, ayah])

  const runAnalysis = useCallback(
    async (userAudio: Blob | AudioBuffer) => {
      setPhase('analyzing')
      setError(null)
      try {
        const refBuffer = await loadReferenceAudio()
        const analysis = await analyzeVoiceSimilarity(refBuffer, userAudio)
        setResult(analysis)
        const saved = savePracticeRecord({
          reciterId,
          surah,
          ayah,
          voiceSimilarity: analysis.voiceSimilarity,
          tone: analysis.tone,
          sound: analysis.sound,
          flow: analysis.flow,
        })
        setSaveResult(saved)
        setPhase('results')
      } catch (e) {
        const detail = e instanceof Error ? e.message : ''
        setError(detail || 'Something went wrong. Tap Listen first, then record again.')
        setPhase('idle')
      }
    },
    [loadReferenceAudio, reciterId, surah, ayah]
  )

  const playReference = useCallback(
    async (opts?: { rate?: Speed; loop?: boolean }) => {
      const rate = opts?.rate ?? speed
      const loop = opts?.loop ?? loopRef
      setError(null)
      stopAudio()
      setPhase('playing')
      try {
        await loadReferenceAudio()
        const url = await getPlayableAyahAudioUrl(reciterId, surah, ayah)
        if (!url) throw new Error('Could not play reciter audio.')
        if (refObjectUrlRef.current) URL.revokeObjectURL(refObjectUrlRef.current)
        refObjectUrlRef.current = url.startsWith('blob:') ? url : null
        const audio = new Audio(url)
        audio.playbackRate = rate
        audio.loop = loop
        audioRef.current = audio
        const detach = attachPlaybackTracking(audio, 'ref')
        audio.onended = () => {
          detach()
          setPhase((p) => (p === 'playing' ? 'idle' : p))
        }
        audio.onerror = () => {
          detach()
          setError('Could not play reciter audio.')
          setPhase('idle')
        }
        await audio.play()
      } catch {
        setError('Could not play reciter audio.')
        setPhase('idle')
      }
    },
    [attachPlaybackTracking, loadReferenceAudio, loopRef, reciterId, speed, stopAudio, surah, ayah]
  )

  const toggleListen = useCallback(() => {
    if (phase === 'playing') {
      stopAudio()
      setPhase('idle')
      return
    }
    void playReference()
  }, [phase, playReference, stopAudio])

  const practiceSlowly = useCallback(() => {
    setSpeed(0.5)
    setLoopRef(true)
    void playReference({ rate: 0.5, loop: true })
  }, [playReference])

  const handleRecord = useCallback(async () => {
    if (recording) {
      const { blob: recordedBlob, audioBuffer } = await stopRecording()
      if (!audioBuffer || !recordedBlob) {
        setError('Recording was too short. Tap Listen first, then recite the full ayah.')
        setPhase('idle')
        return
      }
      await runAnalysis(audioBuffer)
      return
    }
    setError(null)
    setResult(null)
    setSaveResult(null)
    stopAudio()
    clearRecording()
    await startRecording()
    setPhase('recording')
  }, [clearRecording, recording, runAnalysis, startRecording, stopAudio, stopRecording])

  const playUserRecording = useCallback(() => {
    if (!blob) return
    stopAudio()
    const url = URL.createObjectURL(blob)
    const audio = new Audio(url)
    userAudioRef.current = audio
    const detach = attachPlaybackTracking(audio, 'user')
    audio.onended = () => {
      detach()
      URL.revokeObjectURL(url)
    }
    void audio.play()
  }, [attachPlaybackTracking, blob, stopAudio])

  const playBoth = useCallback(async () => {
    stopAudio()
    try {
      const refUrl = await getPlayableAyahAudioUrl(reciterId, surah, ayah)
      if (!refUrl) throw new Error('no url')
      const refAudio = new Audio(refUrl)
      audioRef.current = refAudio
      const detachRef = attachPlaybackTracking(refAudio, 'ref')
      await refAudio.play()
      await new Promise<void>((resolve) => {
        refAudio.onended = () => {
          detachRef()
          resolve()
        }
      })
      if (refUrl.startsWith('blob:')) URL.revokeObjectURL(refUrl)
      if (blob) {
        const userUrl = URL.createObjectURL(blob)
        const userAudio = new Audio(userUrl)
        userAudioRef.current = userAudio
        const detachUser = attachPlaybackTracking(userAudio, 'user')
        await userAudio.play()
        await new Promise<void>((resolve) => {
          userAudio.onended = () => {
            detachUser()
            URL.revokeObjectURL(userUrl)
            resolve()
          }
        })
      }
    } catch {
      clearPlayback()
      setError('Playback failed.')
    }
  }, [attachPlaybackTracking, blob, clearPlayback, reciterId, stopAudio, surah, ayah])

  const reset = useCallback(() => {
    stopAudio()
    clearRecording()
    setResult(null)
    setSaveResult(null)
    setRefPreviewWaveform([])
    setRefDurationMs(0)
    setError(null)
    setPhase('idle')
  }, [clearRecording, stopAudio])

  const showWaveform = Boolean(result || refPreviewWaveform.length > 0)
  const waveformDurationMs = result?.durationMs ?? refDurationMs
  const waveformProps = result
    ? {
        alignedRef: result.alignedRef,
        alignedUser: result.alignedUser,
        matchHeatmap: result.matchHeatmap,
        refPitch: result.alignedRefPitch,
        userPitch: result.alignedUserPitch,
        diffRegions: result.diffRegions,
        frameMs: result.frameMs,
      }
    : {
        alignedRef: refPreviewWaveform,
      }

  const displayArabic = arabicText.trim() || 'Loading ayah text…'

  const focus = useMemo(() => {
    if (!result) return null
    const layers = [
      { key: 'tone' as const, v: result.tone },
      { key: 'sound' as const, v: result.sound },
      { key: 'flow' as const, v: result.flow },
    ].sort((a, b) => a.v - b.v)
    return { ...layers[0], ...FOCUS_COPY[layers[0].key] }
  }, [result])

  const isPlaying = phase === 'playing'

  return (
    <HomeScreen className="max-w-lg mx-auto">
      <div className="pb-[max(2rem,env(safe-area-inset-bottom))]">
        {/* Header with reciter identity */}
        <header className="reveal mb-5 flex items-center gap-3">
          <Link
            href="/imitate"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-2xl bg-[var(--home-card-bg)] text-[var(--home-heading)] ring-1 ring-[var(--home-card-border)] transition-colors hover:bg-[var(--home-sage-soft)]"
            aria-label="Back"
          >
            <ChevronLeft className="h-6 w-6" />
          </Link>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#f4d59b] to-[#e2ab53] text-sm font-bold text-[#2a2258] shadow-[0_8px_20px_-8px_rgba(226,171,83,0.85)]">
            {initialsOf(reciter.name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold uppercase tracking-wider text-[var(--home-sage-deep)]">
              {reciter.name}
            </p>
            <h1 className="home-serif truncate text-lg font-semibold leading-tight text-[var(--home-heading)]">
              {surahName} · Ayah {ayah}
            </h1>
          </div>
          {priorBest !== null && (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-[var(--home-sage-soft)] px-2.5 py-1 text-xs font-bold text-[var(--home-sage-deep)]">
              <Trophy className="h-3.5 w-3.5" />
              {priorBest}%
            </span>
          )}
        </header>

        {/* Stepper */}
        <div className="reveal mb-5 flex items-center gap-1.5" style={{ animationDelay: '60ms' }}>
          {STEPS.map((label, i) => (
            <div key={label} className="flex flex-1 items-center gap-1.5">
              <div
                className={cn(
                  'flex-1 rounded-full py-1.5 text-center text-[11px] font-semibold transition-colors',
                  i < activeStep && 'bg-[var(--home-sage-soft)] text-[var(--home-sage-deep)]',
                  i === activeStep &&
                    'bg-[var(--home-sage-deep)] text-white shadow-[0_6px_16px_-8px_var(--home-sage-deep)]',
                  i > activeStep && 'bg-[var(--home-card-bg)] text-[var(--home-muted)] ring-1 ring-[var(--home-card-border)]'
                )}
              >
                {label}
              </div>
            </div>
          ))}
        </div>

        {/* Ayah */}
        <div
          className="reveal relative mb-5 overflow-hidden rounded-[1.5rem] border border-[var(--home-card-border)] bg-[var(--home-card-bg)] px-5 py-6 shadow-[var(--home-card-shadow)]"
          style={{ animationDelay: '120ms' }}
        >
          <div
            className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full bg-[var(--home-sage)]/10 blur-3xl"
            aria-hidden
          />
          <p className="mb-3 text-center text-xs font-bold uppercase tracking-[0.2em] text-[var(--home-sage-deep)]">
            {surah} : {ayah}
          </p>
          <p
            className="amiri arabic-text text-center text-[clamp(1.4rem,6vw,2rem)] leading-[2.2] text-[var(--home-heading)]"
            dir="rtl"
            lang="ar"
          >
            {displayArabic}
          </p>
        </div>

        {/* Listen / study panel */}
        <div className="reveal mb-5 rounded-[1.5rem] border border-[var(--home-card-border)] bg-[var(--home-card-bg)] p-4 shadow-[var(--home-card-shadow)]" style={{ animationDelay: '180ms' }}>
          <div className="mb-3 flex items-center justify-between">
            <p className="flex items-center gap-2 text-sm font-semibold text-[var(--home-heading)]">
              <Headphones className="h-4 w-4 text-[var(--home-sage-deep)]" />
              Study the reciter
            </p>
            <button
              type="button"
              onClick={() => setLoopRef((v) => !v)}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
                loopRef
                  ? 'bg-[var(--home-sage-deep)] text-white'
                  : 'bg-[var(--app-surface)] text-[var(--home-muted)] ring-1 ring-[var(--home-card-border)]'
              )}
              aria-pressed={loopRef}
            >
              <Repeat className="h-3.5 w-3.5" />
              Loop
            </button>
          </div>

          <button
            type="button"
            onClick={toggleListen}
            disabled={phase === 'analyzing' || recording || surahOnly}
            className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-[var(--home-sage-deep)] py-3.5 text-sm font-bold text-white shadow-[0_14px_30px_-14px_var(--home-sage-deep)] transition-transform active:scale-[0.98] disabled:opacity-50"
          >
            {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
            {isPlaying ? 'Stop' : loopRef ? 'Play on loop' : 'Play reciter'}
          </button>

          <div className="mt-3 flex items-center gap-2">
            <span className="flex items-center gap-1 text-xs font-medium text-[var(--home-muted)]">
              <Gauge className="h-3.5 w-3.5" />
              Speed
            </span>
            <div className="flex flex-1 gap-1.5">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSpeed(s)}
                  className={cn(
                    'flex-1 rounded-lg py-1.5 text-xs font-bold transition-colors',
                    speed === s
                      ? 'bg-[var(--home-sage-soft)] text-[var(--home-sage-deep)] ring-1 ring-[var(--home-sage)]/40'
                      : 'bg-[var(--app-surface)] text-[var(--home-muted)] ring-1 ring-[var(--home-card-border)]'
                  )}
                >
                  {s === 1 ? '1×' : `${s}×`}
                </button>
              ))}
            </div>
          </div>
          <p className="mt-2.5 text-[11px] leading-relaxed text-[var(--home-muted)]">
            Slow it to <strong className="text-[var(--home-heading)]">0.5×</strong> and loop to study every
            rise, fall, and pause before you record.
          </p>
        </div>

        {showWaveform && (
          <div className="mb-5">
            <WaveformCompare
              {...waveformProps}
              durationMs={waveformDurationMs}
              playheadProgress={playback.progress}
              activeTrack={playback.track}
            />
          </div>
        )}

        {/* Record zone with live level meter */}
        <div className="mb-5 flex flex-col items-center gap-3">
          <div className="relative flex h-32 w-32 items-center justify-center">
            {/* live level halo */}
            <span
              className={cn(
                'pointer-events-none absolute inset-0 rounded-full transition-opacity',
                recording ? 'opacity-100' : 'opacity-0'
              )}
              style={{
                background: 'radial-gradient(circle, rgba(239,68,68,0.45), transparent 70%)',
                transform: `scale(${1 + level * 0.6})`,
              }}
              aria-hidden
            />
            <span
              className={cn(
                'pointer-events-none absolute inset-2 rounded-full ring-2 transition-transform',
                recording ? 'ring-red-500/40' : 'ring-transparent'
              )}
              style={{ transform: `scale(${1 + level * 0.28})` }}
              aria-hidden
            />
            <button
              type="button"
              onClick={() => void handleRecord()}
              disabled={phase === 'analyzing' || phase === 'playing'}
              className={cn(
                'relative flex h-24 w-24 items-center justify-center rounded-full shadow-xl transition-all active:scale-95 disabled:opacity-50',
                recording
                  ? 'bg-red-500 text-white'
                  : 'bg-gradient-to-br from-[var(--home-sage)] to-[var(--home-sage-deep)] text-white'
              )}
              aria-label={recording ? 'Stop recording' : 'Start recording'}
            >
              {phase === 'analyzing' ? (
                <Loader2 className="h-9 w-9 animate-spin" />
              ) : recording ? (
                <Square className="h-8 w-8 fill-current" />
              ) : (
                <Mic className="h-9 w-9" />
              )}
            </button>
          </div>
          <p className="text-center text-sm font-medium text-[var(--home-heading)]">
            {phase === 'analyzing'
              ? 'Analyzing your voice…'
              : recording
                ? 'Listening — tap to finish'
                : result
                  ? 'Record again to beat your score'
                  : 'Tap to record your recitation'}
          </p>
          {surahOnly && (
            <p className="max-w-xs text-center text-xs text-[var(--home-muted)]">
              {SURAH_ONLY_RECITER_HINT}
            </p>
          )}
        </div>

        {!result && (
          <div className="mb-5">
            <button
              type="button"
              onClick={reset}
              disabled={phase === 'analyzing' || recording}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] py-3 text-sm font-semibold text-[var(--home-muted)] transition-colors hover:text-[var(--home-heading)] disabled:opacity-50"
            >
              <RotateCcw className="h-4 w-4" />
              Start over
            </button>
          </div>
        )}

        {(error || recorderError) && (
          <p className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">
            {error ?? recorderError}
          </p>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-4">
            <div className="relative overflow-hidden rounded-[1.6rem] border border-[var(--home-card-border)] bg-[var(--home-card-bg)] p-5 shadow-[var(--home-card-shadow)]">
              {saveResult?.isNewBest && (
                <span className="absolute right-4 top-4 flex items-center gap-1 rounded-full bg-gradient-to-r from-[#f4d59b] to-[#e2ab53] px-2.5 py-1 text-xs font-bold text-[#2a2258] shadow">
                  <Sparkles className="h-3.5 w-3.5" />
                  New best!
                </span>
              )}
              <div className="flex flex-col items-center">
                <VoiceScoreRing value={result.voiceSimilarity} />
              </div>

              {/* delta / best / attempt row */}
              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-[var(--app-surface)] px-2 py-2.5 text-center ring-1 ring-[var(--home-card-border)]">
                  <p className="text-[10px] uppercase tracking-wider text-[var(--home-muted)]">Change</p>
                  <p
                    className={cn(
                      'mt-0.5 flex items-center justify-center gap-0.5 text-sm font-bold',
                      saveResult?.delta == null
                        ? 'text-[var(--home-muted)]'
                        : saveResult.delta >= 0
                          ? 'text-emerald-500'
                          : 'text-red-500'
                    )}
                  >
                    {saveResult?.delta != null && <TrendingUp className="h-3.5 w-3.5" />}
                    {saveResult?.delta == null
                      ? 'First'
                      : `${saveResult.delta >= 0 ? '+' : ''}${saveResult.delta}`}
                  </p>
                </div>
                <div className="rounded-xl bg-[var(--app-surface)] px-2 py-2.5 text-center ring-1 ring-[var(--home-card-border)]">
                  <p className="text-[10px] uppercase tracking-wider text-[var(--home-muted)]">Best</p>
                  <p className="mt-0.5 text-sm font-bold text-[var(--home-sage-deep)]">
                    {saveResult?.record.bestVoiceSimilarity ?? result.voiceSimilarity}%
                  </p>
                </div>
                <div className="rounded-xl bg-[var(--app-surface)] px-2 py-2.5 text-center ring-1 ring-[var(--home-card-border)]">
                  <p className="text-[10px] uppercase tracking-wider text-[var(--home-muted)]">Attempt</p>
                  <p className="mt-0.5 text-sm font-bold text-[var(--home-heading)]">
                    #{saveResult?.record.attempts ?? 1}
                  </p>
                </div>
              </div>

              {saveResult && saveResult.record.history.length > 2 && (
                <div className="mt-3 rounded-xl bg-[var(--app-surface)] px-3 py-2 ring-1 ring-[var(--home-card-border)]">
                  <p className="mb-0.5 text-[10px] uppercase tracking-wider text-[var(--home-muted)]">
                    Your progress
                  </p>
                  <Sparkline values={saveResult.record.history} />
                </div>
              )}
            </div>

            {/* Focus drill */}
            {focus && (
              <div className="rounded-2xl border border-[var(--home-sage)]/30 bg-[var(--home-sage-soft)] p-4">
                <p className="flex items-center gap-2 text-sm font-bold text-[var(--home-heading)]">
                  <Target className="h-4 w-4 text-[var(--home-sage-deep)]" />
                  {focus.title}
                  <span className="ml-auto text-xs font-bold text-[var(--home-sage-deep)]">{focus.v}%</span>
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--app-text)]">{focus.body}</p>
                <button
                  type="button"
                  onClick={practiceSlowly}
                  disabled={recording || phase === 'analyzing' || surahOnly}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--home-sage-deep)] py-2.5 text-sm font-bold text-white transition-transform active:scale-[0.98] disabled:opacity-50"
                >
                  <Play className="h-4 w-4 fill-current" />
                  Practice this slowly (0.5× loop)
                </button>
              </div>
            )}

            <VoiceSimilarityCard
              voiceSimilarity={result.voiceSimilarity}
              tone={result.tone}
              sound={result.sound}
              flow={result.flow}
              detail={result.detail}
              defaultOpen
            />

            <div className="rounded-2xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] p-4 shadow-[var(--home-card-shadow)]">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--home-muted)]">
                Coaching tips
              </p>
              <ul className="space-y-2">
                {result.tips.map((tip, i) => (
                  <li key={i} className="flex gap-2 text-sm leading-relaxed text-[var(--app-text)]">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--home-sage-deep)]" />
                    {tip}
                  </li>
                ))}
              </ul>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => void playBoth()}
                className="flex items-center justify-center gap-2 rounded-xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] py-3 text-sm font-semibold text-[var(--home-heading)] shadow-[var(--home-card-shadow)] transition-transform active:scale-[0.98]"
              >
                <Play className="h-4 w-4 fill-current" />
                Compare A/B
              </button>
              <button
                type="button"
                onClick={playUserRecording}
                className="flex items-center justify-center gap-2 rounded-xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] py-3 text-sm font-semibold text-[var(--home-heading)] shadow-[var(--home-card-shadow)] transition-transform active:scale-[0.98]"
              >
                <Headphones className="h-4 w-4" />
                Play yours
              </button>
            </div>
            <button
              type="button"
              onClick={() => void handleRecord()}
              disabled={phase === 'analyzing'}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-[var(--home-sage)] to-[var(--home-sage-deep)] py-3.5 text-sm font-bold text-white shadow-[0_14px_30px_-14px_var(--home-sage-deep)] transition-transform active:scale-[0.98] disabled:opacity-50"
            >
              <Mic className="h-4 w-4" />
              Try again
            </button>
          </div>
        )}

        {phase === 'idle' && !result && !error && !recorderError && (
          <div className="rounded-2xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] px-4 py-3.5 text-sm leading-relaxed text-[var(--home-muted)]">
            <span className="font-semibold text-[var(--home-heading)]">How it works:</span> listen to the
            reciter (slow it down to study), then tap the mic and recite the same ayah. You&apos;ll get a
            voice-match score with tone, sound, and flow breakdowns — and a focus drill to improve.
          </div>
        )}
      </div>
    </HomeScreen>
  )
}
