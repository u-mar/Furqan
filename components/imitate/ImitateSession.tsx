'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ChevronLeft,
  Loader2,
  Mic,
  Play,
  RotateCcw,
  Square,
} from 'lucide-react'
import Link from 'next/link'
import Button from '@/components/ui/Button'
import VoiceSimilarityCard from '@/components/imitate/VoiceSimilarityCard'
import WaveformCompare from '@/components/imitate/WaveformCompare'
import { useRecitationRecorder } from '@/hooks/useRecitationRecorder'
import { getReciterById, everyAyahAudioUrl } from '@/lib/reciters'
import { getPlayableAyahAudioUrl } from '@/lib/offline-audio'
import { savePracticeRecord } from '@/lib/imitate-progress'
import { analyzeVoiceSimilarity, type VoiceSimilarityResult } from '@/lib/voice-similarity'
import { cn } from '@/lib/cn'

type Phase = 'idle' | 'playing' | 'recording' | 'analyzing' | 'results'

interface ImitateSessionProps {
  surah: number
  ayah: number
  reciterId: string
  arabicText: string
  surahName: string
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
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const userAudioRef = useRef<HTMLAudioElement | null>(null)
  const refBlobRef = useRef<Blob | null>(null)
  const { recording, blob, error: recorderError, startRecording, stopRecording, clearRecording } =
    useRecitationRecorder()

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    if (userAudioRef.current) {
      userAudioRef.current.pause()
      userAudioRef.current = null
    }
  }, [])

  useEffect(() => () => stopAudio(), [stopAudio])

  const fetchReferenceBlob = useCallback(async () => {
    const url = await getPlayableAyahAudioUrl(reciter.folder, surah, ayah)
    if (!url) throw new Error('Reference audio unavailable')
    const res = await fetch(url)
    const blob = await res.blob()
    if (url.startsWith('blob:')) URL.revokeObjectURL(url)
    refBlobRef.current = blob
    return blob
  }, [reciter.folder, surah, ayah])

  const playReference = useCallback(async () => {
    setError(null)
    stopAudio()
    setPhase('playing')
    try {
      const url = await getPlayableAyahAudioUrl(reciter.folder, surah, ayah)
      if (!url) throw new Error('Could not play reciter audio.')
      const audio = new Audio(url)
      audioRef.current = audio
      audio.onended = () => {
        setPhase('idle')
        if (url.startsWith('blob:')) URL.revokeObjectURL(url)
      }
      audio.onerror = () => {
        setError('Could not play reciter audio.')
        setPhase('idle')
      }
      await audio.play()
    } catch {
      setError('Could not play reciter audio.')
      setPhase('idle')
    }
  }, [reciter.folder, stopAudio, surah, ayah])

  const handleRecord = useCallback(async () => {
    if (recording) {
      stopRecording()
      setPhase('idle')
      return
    }
    setError(null)
    setResult(null)
    clearRecording()
    await startRecording()
    setPhase('recording')
  }, [clearRecording, recording, startRecording, stopRecording])

  const analyze = useCallback(async () => {
    if (!blob) return
    setPhase('analyzing')
    setError(null)
    try {
      const refBlob = refBlobRef.current ?? (await fetchReferenceBlob())
      const analysis = await analyzeVoiceSimilarity(refBlob, blob)
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
    } catch {
      setError('Could not analyze your recording. Try again in a quiet room.')
      setPhase('idle')
    }
  }, [blob, fetchReferenceBlob, reciterId, surah, ayah])

  useEffect(() => {
    if (!recording && blob && phase === 'recording') {
      void analyze()
    }
  }, [recording, blob, phase, analyze])

  const playUserRecording = useCallback(() => {
    if (!blob) return
    stopAudio()
    const url = URL.createObjectURL(blob)
    const audio = new Audio(url)
    userAudioRef.current = audio
    audio.onended = () => URL.revokeObjectURL(url)
    void audio.play()
  }, [blob, stopAudio])

  const playBoth = useCallback(async () => {
    stopAudio()
    try {
      const refUrl = everyAyahAudioUrl(reciter.folder, surah, ayah)
      const refAudio = new Audio(refUrl)
      audioRef.current = refAudio
      await refAudio.play()
      await new Promise<void>((resolve) => {
        refAudio.onended = () => resolve()
      })
      if (blob) {
        const userUrl = URL.createObjectURL(blob)
        const userAudio = new Audio(userUrl)
        userAudioRef.current = userAudio
        userAudio.onended = () => URL.revokeObjectURL(userUrl)
        await userAudio.play()
      }
    } catch {
      setError('Playback failed.')
    }
  }, [blob, reciter.folder, stopAudio, surah, ayah])

  const reset = useCallback(() => {
    stopAudio()
    clearRecording()
    setResult(null)
    setError(null)
    setPhase('idle')
  }, [clearRecording, stopAudio])

  return (
    <div className="mx-auto max-w-lg pb-8">
      <header className="mb-6 flex items-center gap-3">
        <Link
          href="/imitate"
          className="flex h-10 w-10 items-center justify-center rounded-xl text-[var(--app-muted)] hover:bg-[var(--app-surface)]"
          aria-label="Back"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0">
          <p className="truncate text-sm text-[var(--app-muted)]">{reciter.name}</p>
          <h1 className="home-serif truncate text-lg font-semibold">
            {surahName} · Ayah {ayah}
          </h1>
        </div>
      </header>

      <div
        className="mb-6 rounded-2xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] p-5 text-right font-quran text-2xl leading-loose text-[var(--app-text)]"
        dir="rtl"
      >
        {arabicText}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Button
          variant="secondary"
          onClick={() => void playReference()}
          disabled={phase === 'playing' || phase === 'analyzing'}
        >
          <Play className="h-4 w-4" />
          Listen
        </Button>
        <Button
          variant={recording ? 'primary' : 'secondary'}
          onClick={() => void handleRecord()}
          disabled={phase === 'analyzing' || phase === 'playing'}
          className={cn(recording && 'bg-red-600 hover:bg-red-700 dark:bg-red-500')}
        >
          {recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          {recording ? 'Stop' : 'Record'}
        </Button>
        {blob && phase !== 'analyzing' && (
          <Button variant="ghost" onClick={reset}>
            <RotateCcw className="h-4 w-4" />
            Retry
          </Button>
        )}
      </div>

      {phase === 'playing' && (
        <p className="mb-4 text-sm text-[var(--home-sage)]">Playing reciter…</p>
      )}
      {phase === 'recording' && (
        <p className="mb-4 animate-pulse text-sm text-red-500">Recording — recite the ayah now…</p>
      )}
      {phase === 'analyzing' && (
        <div className="mb-4 flex items-center gap-2 text-sm text-[var(--app-muted)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Analyzing voice similarity…
        </div>
      )}
      {(error || recorderError) && (
        <p className="mb-4 text-sm text-red-500">{error ?? recorderError}</p>
      )}

      {result && (
        <div className="space-y-4">
          <VoiceSimilarityCard
            voiceSimilarity={result.voiceSimilarity}
            tone={result.tone}
            sound={result.sound}
            flow={result.flow}
          />
          <WaveformCompare
            refWaveform={result.refWaveform}
            userWaveform={result.userWaveform}
            diffRegions={result.diffRegions}
          />
          <div className="rounded-2xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] p-4">
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
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => void playBoth()} className="flex-1">
              Compare A/B
            </Button>
            <Button variant="secondary" onClick={playUserRecording} className="flex-1">
              Play yours
            </Button>
          </div>
        </div>
      )}

      {phase === 'idle' && !result && (
        <p className="text-sm leading-relaxed text-[var(--app-muted)]">
          Listen to the reciter, then record yourself reciting the same ayah. We&apos;ll score how
          similar your voice sounds in tone, sound, and flow.
        </p>
      )}
    </div>
  )
}
