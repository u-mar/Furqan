'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, FileAudio, FileUp, Loader2 } from 'lucide-react'
import {
  DEFAULT_FEATURE_SETTINGS,
  loadFeatureSettings,
  saveFeatureSettings,
  type FeatureSettings,
} from '@/lib/asr/offline-features'
import { isQariAsrModelReady, onQariAsrModelChange, saveQariAsrModelFile } from '@/lib/asr/offline-model-cache'
import { ASR_SAMPLE_RATE, decodeRecording, recognize, releaseOfflineSession, type Recognition } from '@/lib/asr/offline-recognizer'
import { buildQuranWordIndex, markAyat } from '@/lib/asr/quran-match'
import { loadQuranData } from '@/lib/quran'
import { normalizeArabic } from '@/lib/search-ayahs'
import { cn } from '@/lib/cn'

/**
 * A private page for trying the recitation model on a phone: choose the model
 * and a clip you know, and it listens to it with every combination of the
 * audio settings the toolkits disagree on, shows what each one heard and how
 * sure the model was, and keeps the one you pick. Also shows how long
 * listening takes on this phone, and which ayat the clip was matched to.
 */

const COMBINATIONS: FeatureSettings[] = (['symmetric', 'periodic'] as const).flatMap((window) =>
  (['constant', 'reflect'] as const).flatMap((pad) =>
    (['per_feature', 'none'] as const).map((normalize) => ({ window, pad, normalize }))
  )
)

/** Long clips take long to try eight times: only the start is used. */
const TRY_SECONDS = 25

interface Attempt {
  settings: FeatureSettings
  recognition: Recognition | null
  error?: string
  seconds: number
}

const label = (s: FeatureSettings) => `${s.window} · ${s.pad} · ${s.normalize === 'per_feature' ? 'normalised' : 'raw'}`
const same = (a: FeatureSettings, b: FeatureSettings) => a.window === b.window && a.pad === b.pad && a.normalize === b.normalize

export default function AsrTestPage() {
  const [ready, setReady] = useState(false)
  const [saved, setSaved] = useState<FeatureSettings>(DEFAULT_FEATURE_SETTINGS)
  const [clip, setClip] = useState<{ name: string; samples: Float32Array } | null>(null)
  const [attempts, setAttempts] = useState<Attempt[]>([])
  const [running, setRunning] = useState<string | null>(null)
  const [report, setReport] = useState<string[] | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const modelRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    setReady(isQariAsrModelReady())
    setSaved(loadFeatureSettings())
    return onQariAsrModelChange(() => setReady(isQariAsrModelReady()))
  }, [])

  const chooseModel = async (file: File | undefined) => {
    if (!file) return
    setNotice(null)
    try {
      releaseOfflineSession()
      await saveQariAsrModelFile(file)
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Could not save that file.')
    }
  }

  const chooseClip = async (file: File | undefined) => {
    if (!file) return
    setNotice(null)
    setAttempts([])
    setReport(null)
    try {
      setClip({ name: file.name, samples: await decodeRecording(file) })
    } catch {
      setClip(null)
      setNotice('That audio could not be read.')
    }
  }

  const run = async () => {
    if (!clip) return
    setAttempts([])
    setReport(null)
    setNotice(null)
    const samples = clip.samples.subarray(0, TRY_SECONDS * ASR_SAMPLE_RATE)
    const results: Attempt[] = []
    for (const settings of COMBINATIONS) {
      setRunning(label(settings))
      const started = performance.now()
      try {
        const recognition = await recognize(samples, { settings })
        results.push({ settings, recognition, seconds: (performance.now() - started) / 1000 })
      } catch (err) {
        results.push({ settings, recognition: null, error: err instanceof Error ? err.message : 'failed', seconds: 0 })
        // A model that cannot run at all fails the same way every time.
        setAttempts([...results])
        break
      }
      // Most sure first; one that heard nothing is last, however "sure" it is of the silence.
      setAttempts([...results].sort((a, b) => (b.recognition?.confidence ?? 0) - (a.recognition?.confidence ?? 0)))
    }
    setRunning(null)
  }

  const showAyat = async () => {
    if (!clip) return
    setRunning('matching')
    setReport(null)
    try {
      const [recognition, data] = await Promise.all([recognize(clip.samples, { settings: saved }), loadQuranData()])
      const index = buildQuranWordIndex(data.verses, normalizeArabic)
      const marking = markAyat(recognition.words, index, normalizeArabic)
      setReport([
        `${marking.timeline.length} ayat, ${marking.matched} of ${marking.heard} words matched (${Math.round(marking.coverage * 100)}%)`,
        ...marking.timeline.map((e) => `${e.verseKey}  at ${e.atSeconds.toFixed(1)}s`),
        '',
        recognition.text,
      ])
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'failed')
    } finally {
      setRunning(null)
    }
  }

  const best = attempts.find((a) => a.recognition?.words.length)

  return (
    <main className="qari-theme min-h-[100dvh] px-4 pb-16 pt-[max(1rem,env(safe-area-inset-top))] text-[var(--app-text)]">
      <div className="mx-auto max-w-lg">
        <header className="flex items-center gap-3">
          <Link href="/settings" className="home-round ed-focus" aria-label="Back">
            <ChevronLeft className="h-5 w-5" strokeWidth={1.9} />
          </Link>
          <h1 className="home-serif text-[1.3125rem] font-medium">Test recognition</h1>
        </header>

        <section className="home-card mt-5 rounded-2xl p-4">
          <p className="text-[13px] font-semibold">1. The model</p>
          <p className="mt-1 text-[13px] text-[var(--home-muted)]">{ready ? 'Saved on this phone.' : 'Not saved yet. Choose the .onnx file (int8 or fp32).'}</p>
          <button
            type="button"
            onClick={() => modelRef.current?.click()}
            className="ed-focus mt-3 flex h-10 items-center gap-2 rounded-full border border-[var(--home-rule-strong)] px-4 text-[13px] font-semibold"
          >
            <FileUp className="h-4 w-4" strokeWidth={2} />
            {ready ? 'Replace the model' : 'Choose model file'}
          </button>
          <input ref={modelRef} type="file" accept=".onnx" className="hidden" onChange={(e) => void chooseModel(e.target.files?.[0])} />
        </section>

        <section className="home-card mt-3 rounded-2xl p-4">
          <p className="text-[13px] font-semibold">2. A clip you know</p>
          <p className="mt-1 text-[13px] text-[var(--home-muted)]">
            A recitation you can check by ear: Al-Fatiha, or a few ayat. The first {TRY_SECONDS} seconds are tried with every setting.
          </p>
          <label className="ed-focus mt-3 flex h-10 w-fit cursor-pointer items-center gap-2 rounded-full border border-[var(--home-rule-strong)] px-4 text-[13px] font-semibold">
            <FileAudio className="h-4 w-4" strokeWidth={2} />
            {clip ? clip.name : 'Choose audio'}
            <input type="file" accept="audio/*" className="hidden" onChange={(e) => void chooseClip(e.target.files?.[0])} />
          </label>
          {clip ? <p className="mt-2 text-xs text-[var(--home-muted)]">{(clip.samples.length / ASR_SAMPLE_RATE).toFixed(1)} seconds</p> : null}
        </section>

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            disabled={!ready || !clip || running !== null}
            onClick={() => void run()}
            className="ed-ink ed-focus flex h-11 flex-1 items-center justify-center gap-2 rounded-full text-[14px] font-semibold disabled:opacity-50"
          >
            {running && running !== 'matching' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Try the settings
          </button>
          <button
            type="button"
            disabled={!ready || !clip || running !== null}
            onClick={() => void showAyat()}
            className="ed-focus flex h-11 flex-1 items-center justify-center gap-2 rounded-full border border-[var(--home-rule-strong)] text-[14px] font-semibold disabled:opacity-50"
          >
            {running === 'matching' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Find the ayat
          </button>
        </div>
        {running && running !== 'matching' ? <p className="mt-2 text-center text-xs text-[var(--home-muted)]">Trying {running}…</p> : null}
        {notice ? <p className="mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">{notice}</p> : null}

        {attempts.length > 0 ? (
          <section className="mt-4 space-y-2.5">
            <p className="mx-1 text-xs text-[var(--home-muted)]">
              Most sure first. The one that reads correctly is the one to keep; it is almost always the one with the highest confidence.
            </p>
            {attempts.map((a, i) => (
              <div key={label(a.settings)} className={cn('home-card rounded-2xl p-3.5', i === 0 && a.recognition?.words.length && 'ring-2 ring-[var(--home-sage)]')}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[13px] font-semibold">{label(a.settings)}</p>
                  {a.recognition ? (
                    <p className="text-xs tabular-nums text-[var(--home-muted)]">
                      {a.recognition.words.length ? `${Math.round(a.recognition.confidence * 100)}% sure · ` : ''}
                      {a.seconds.toFixed(1)}s
                    </p>
                  ) : null}
                </div>
                {a.recognition ? (
                  <p className="amiri mt-2 text-[1.125rem] leading-loose" dir="rtl">
                    {a.recognition.text || <span className="text-sm text-[var(--home-muted)]">Heard nothing</span>}
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-red-600 dark:text-red-400">{a.error}</p>
                )}
                {a.recognition?.words.length ? (
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        saveFeatureSettings(a.settings)
                        setSaved(a.settings)
                      }}
                      className="ed-focus h-8 rounded-full border border-[var(--home-rule-strong)] px-3.5 text-[12.5px] font-semibold"
                    >
                      Use these settings
                    </button>
                    {same(a.settings, saved) ? <span className="text-xs font-semibold text-[var(--home-sage-deep)]">In use</span> : null}
                  </div>
                ) : null}
              </div>
            ))}
            {best && attempts.length === COMBINATIONS.length ? (
              <p className="mx-1 text-xs text-[var(--home-muted)]">
                Listening to {Math.min(TRY_SECONDS, Math.round((clip?.samples.length ?? 0) / ASR_SAMPLE_RATE))} seconds took about {best.seconds.toFixed(1)} s on this phone.
              </p>
            ) : null}
          </section>
        ) : null}

        {report ? (
          <section className="home-card mt-4 rounded-2xl p-4">
            <p className="text-[13px] font-semibold">Ayat found (settings: {label(saved)})</p>
            <pre className="mt-2 whitespace-pre-wrap text-[12.5px] leading-relaxed">{report.slice(0, -2).join('\n')}</pre>
            <p className="amiri mt-3 text-[1.0625rem] leading-loose" dir="rtl">
              {report[report.length - 1]}
            </p>
          </section>
        ) : null}
      </div>
    </main>
  )
}
