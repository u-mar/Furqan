'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ChevronLeft,
  Loader2,
  Mic,
  Play,
  RotateCcw,
  Square,
  Volume2,
} from 'lucide-react'
import Button from '@/components/ui/Button'
import HomeScreen from '@/components/home/HomeScreen'
import VoiceSimilarityCard from '@/components/imitate/VoiceSimilarityCard'
import WaveformCompare from '@/components/imitate/WaveformCompare'
import { useRecitationRecorder } from '@/hooks/useRecitationRecorder'
import { getReciterById, isSurahOnlyReciter, SURAH_ONLY_RECITER_HINT } from '@/lib/reciters'
import { getPlayableAyahAudioUrl } from '@/lib/offline-audio'
import { savePracticeRecord } from '@/lib/imitate-progress'
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

const STEPS = ['Listen', 'Record', 'Results'] as const

function stepIndex(phase: Phase): number {
  if (phase === 'results') return 2
  if (phase === 'recording' || phase === 'analyzing') return 1
  return 0
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
  const [refPreviewWaveform, setRefPreviewWaveform] = useState<number[]>([])
  const [refDurationMs, setRefDurationMs] = useState(0)
  const [playback, setPlayback] = useState<PlaybackState>({ progress: 0, track: null })
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const userAudioRef = useRef<HTMLAudioElement | null>(null)
  const playbackRafRef = useRef<number | null>(null)
  const refAudioBufferRef = useRef<AudioBuffer | null>(null)
  const refObjectUrlRef = useRef<string | null>(null)
  const { recording, blob, error: recorderError, startRecording, stopRecording, clearRecording } =
    useRecitationRecorder()

  const activeStep = stepIndex(phase)

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
  }, [reciter, surah, ayah])

  const runAnalysis = useCallback(
    async (userAudio: Blob | AudioBuffer) => {
      setPhase('analyzing')
      setError(null)
      try {
        const refBuffer = await loadReferenceAudio()
        const analysis = await analyzeVoiceSimilarity(refBuffer, userAudio)
        setResult(analysis)
        savePracticeRecord({
          reciterId,
          surah,
          ayah,
          voiceSimilarity: analysis.voiceSimilarity,
          tone: analysis.tone,
          sound: analysis.sound,
          flow: analysis.flow,
        })
        setPhase('results')
      } catch (e) {
        const detail = e instanceof Error ? e.message : ''
        setError(detail || 'Something went wrong. Tap Listen first, then record again.')
        setPhase('idle')
      }
    },
    [loadReferenceAudio, reciterId, surah, ayah]
  )

  const playReference = useCallback(async () => {
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
  }, [attachPlaybackTracking, loadReferenceAudio, reciterId, stopAudio, surah, ayah])

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
    clearRecording()
    await startRecording()
    setPhase('recording')
  }, [clearRecording, recording, runAnalysis, startRecording, stopRecording])

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

  return (
    <HomeScreen className="max-w-lg mx-auto">
      <div className="pb-[max(2rem,env(safe-area-inset-bottom))]">
        <header className="mb-6 flex items-center gap-3">
          <Link
            href="/imitate"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-[var(--home-sage-deep)] hover:bg-[var(--app-surface)]"
            aria-label="Back"
          >
            <ChevronLeft className="h-7 w-7" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold uppercase tracking-wider text-[var(--app-muted)]">
              {reciter.name}
            </p>
            <h1 className="home-serif truncate text-xl font-semibold text-[var(--home-heading)]">
              {surahName} · Ayah {ayah}
            </h1>
          </div>
        </header>

        <div className="mb-6 flex gap-2">
          {STEPS.map((label, i) => (
            <div
              key={label}
              className={cn(
                'flex-1 rounded-xl border px-2 py-2 text-center text-xs font-medium transition-colors',
                i <= activeStep
                  ? 'border-[var(--home-sage)]/40 bg-[var(--home-sage-soft)] text-[var(--home-sage-deep)]'
                  : 'border-[var(--home-card-border)] bg-[var(--home-card-bg)] text-[var(--app-muted)]'
              )}
            >
              {label}
            </div>
          ))}
        </div>

        <div
          className={cn(
            'mb-6 rounded-2xl border-2 px-4 py-5 shadow-[var(--home-card-shadow)]',
            'border-[var(--home-sage)]/25 bg-[var(--home-card-bg)]'
          )}
        >
          <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-[var(--home-sage-deep)]">
            {surah}:{ayah}
          </p>
          <p
            className="amiri arabic-text text-center text-[clamp(1.35rem,5.5vw,1.85rem)] leading-[2.2] text-[var(--home-heading)]"
            dir="rtl"
            lang="ar"
          >
            {displayArabic}
          </p>
        </div>

        {showWaveform && (
          <div className="mb-6">
            <WaveformCompare
              {...waveformProps}
              durationMs={waveformDurationMs}
              playheadProgress={playback.progress}
              activeTrack={playback.track}
            />
          </div>
        )}

        <div className="mb-6 flex flex-col items-center gap-4">
          <button
            type="button"
            onClick={() => void handleRecord()}
            disabled={phase === 'analyzing' || phase === 'playing'}
            className={cn(
              'relative flex h-28 w-28 items-center justify-center rounded-full shadow-lg transition-all active:scale-95 disabled:opacity-50',
              recording
                ? 'bg-red-500 text-white ring-4 ring-red-500/30'
                : 'bg-[var(--home-sage-deep)] text-white ring-4 ring-[var(--home-sage)]/25'
            )}
            aria-label={recording ? 'Stop recording' : 'Start recording'}
          >
            {phase === 'analyzing' ? (
              <Loader2 className="h-10 w-10 animate-spin" />
            ) : recording ? (
              <Square className="h-9 w-9 fill-current" />
            ) : (
              <Mic className="h-10 w-10" />
            )}
            {recording && (
              <span className="absolute -top-1 right-0 flex h-4 w-4">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-300 opacity-75" />
                <span className="relative inline-flex h-4 w-4 rounded-full bg-red-200" />
              </span>
            )}
          </button>
          <p className="text-center text-sm font-medium text-[var(--home-heading)]">
            {phase === 'analyzing'
              ? 'Analyzing voice similarity…'
              : recording
                ? 'Tap to stop recording'
                : 'Tap to record your recitation'}
          </p>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-3">
          <Button
            variant="secondary"
            size="lg"
            onClick={() => void playReference()}
            disabled={phase === 'playing' || phase === 'analyzing' || recording}
            className="w-full"
          >
            <Play className="h-4 w-4" />
            Listen
          </Button>
          <Button
            variant="secondary"
            size="lg"
            onClick={reset}
            disabled={phase === 'analyzing' || recording}
            className="w-full"
          >
            <RotateCcw className="h-4 w-4" />
            Start over
          </Button>
        </div>

        {phase === 'playing' && (
          <p className="mb-4 flex items-center justify-center gap-2 text-sm text-[var(--home-sage-deep)]">
            <Volume2 className="h-4 w-4" />
            Playing reciter…
          </p>
        )}

        {(error || recorderError) && (
          <p className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">
            {error ?? recorderError}
          </p>
        )}

        {result && (
          <div className="space-y-4">
            <VoiceSimilarityCard
              voiceSimilarity={result.voiceSimilarity}
              tone={result.tone}
              sound={result.sound}
              flow={result.flow}
              detail={result.detail}
            />
            <div className="rounded-2xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] p-4 shadow-[var(--home-card-shadow)]">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--app-muted)]">
                Coaching tips
              </p>
              <ul className="space-y-2">
                {result.tips.map((tip, i) => (
                  <li key={i} className="text-sm leading-relaxed text-[var(--app-text)]">
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="secondary" size="lg" onClick={() => void playBoth()} className="w-full">
                Compare A/B
              </Button>
              <Button variant="secondary" size="lg" onClick={playUserRecording} className="w-full">
                Play yours
              </Button>
            </div>
          </div>
        )}

        {phase === 'idle' && !result && !error && !recorderError && (
          <p className="rounded-2xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] px-4 py-3 text-sm leading-relaxed text-[var(--app-muted)]">
            First tap <strong className="text-[var(--home-heading)]">Listen</strong> to hear the
            reciter, then tap the mic button and recite the same ayah. We&apos;ll score how similar
            your voice sounds.
          </p>
        )}
      </div>
    </HomeScreen>
  )
}
