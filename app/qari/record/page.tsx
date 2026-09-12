'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Mic, Pause, Play, RotateCcw, Send, Square } from 'lucide-react'
import { Notice, QariHeader, QariScreen, useNotice, useViewer } from '@/components/qari/QariShell'
import AccountSheet from '@/components/settings/AccountSheet'
import { useQariRecorder } from '@/hooks/useQariRecorder'
import { getChapters } from '@/lib/quran'
import { formatDuration, publishRecitation } from '@/lib/qari'
import { cn } from '@/lib/cn'
import type { Chapter } from '@/types'

export default function QariRecordPage() {
  const router = useRouter()
  const viewer = useViewer()
  const { notice, setNotice } = useNotice()
  const { state, start, stop, reset, supported } = useQariRecorder()

  const [chapters, setChapters] = useState<Chapter[]>([])
  const [surahId, setSurahId] = useState(1)
  const [fromAyah, setFromAyah] = useState(1)
  const [toAyah, setToAyah] = useState(1)
  const [caption, setCaption] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)

  const previewRef = useRef<HTMLAudioElement | null>(null)
  const [previewing, setPreviewing] = useState(false)

  useEffect(() => {
    getChapters()
      .then(setChapters)
      .catch(() => {})
  }, [])

  useEffect(() => {
    return () => {
      previewRef.current?.pause()
      if (previewRef.current?.src) URL.revokeObjectURL(previewRef.current.src)
      previewRef.current = null
    }
  }, [])

  const chapter = useMemo(() => chapters.find((c) => c.id === surahId), [chapters, surahId])
  const maxAyah = chapter?.versesCount ?? 286

  useEffect(() => {
    setFromAyah((v) => Math.min(Math.max(1, v), maxAyah))
    setToAyah((v) => Math.min(Math.max(1, v), maxAyah))
  }, [maxAyah])

  const togglePreview = useCallback(() => {
    if (!state.blob) return
    if (previewing) {
      previewRef.current?.pause()
      return
    }
    if (!previewRef.current) {
      const audio = new Audio(URL.createObjectURL(state.blob))
      audio.addEventListener('play', () => setPreviewing(true))
      audio.addEventListener('pause', () => setPreviewing(false))
      audio.addEventListener('ended', () => setPreviewing(false))
      previewRef.current = audio
    }
    void previewRef.current.play().catch(() => setNotice('Could not play that back.'))
  }, [previewing, setNotice, state.blob])

  const discard = useCallback(() => {
    previewRef.current?.pause()
    if (previewRef.current?.src) URL.revokeObjectURL(previewRef.current.src)
    previewRef.current = null
    setPreviewing(false)
    reset()
  }, [reset])

  const handlePublish = useCallback(async () => {
    if (!state.blob) return
    if (!viewer) {
      setAccountOpen(true)
      return
    }
    if (toAyah < fromAyah) {
      setNotice('The last ayah comes before the first.')
      return
    }

    setPublishing(true)
    try {
      await publishRecitation({
        blob: state.blob,
        mimeType: state.mimeType,
        durationSec: state.durationSec,
        surahId,
        surahName: chapter?.englishName || `Surah ${surahId}`,
        fromAyah,
        toAyah,
        caption: caption.trim(),
        userId: viewer.id,
        userName: viewer.name,
        userUsername: viewer.username,
      })
      router.push(`/qari/${encodeURIComponent(viewer.username)}`)
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Could not publish.')
      setPublishing(false)
    }
  }, [
    caption,
    chapter,
    fromAyah,
    router,
    setNotice,
    state.blob,
    state.durationSec,
    state.mimeType,
    surahId,
    toAyah,
    viewer,
  ])

  const hasTake = Boolean(state.blob)

  return (
    <QariScreen>
      <QariHeader eyebrow="Qari" title="Record" backHref="/qari" />

      {!supported ? (
        <p className="ed-card rounded-[1.5rem] p-6 text-center text-sm leading-relaxed text-[var(--home-muted)]">
          This browser can’t record audio. Try Chrome on Android, or Safari on iPhone.
        </p>
      ) : (
        <>
          {/* Recorder */}
          <section className="ed-card rounded-[1.5rem] p-6 text-center">
            <div className="relative mx-auto flex h-36 w-36 items-center justify-center">
              {/* Level ring — scales with your voice while recording */}
              <span
                className="absolute inset-0 rounded-full bg-[var(--home-sage-soft)] transition-transform duration-75"
                style={{ transform: `scale(${state.recording ? 1 + state.level * 0.35 : 0.82})` }}
                aria-hidden
              />
              <button
                type="button"
                onClick={state.recording ? stop : () => void start()}
                disabled={hasTake}
                className={cn(
                  'ed-focus relative flex h-24 w-24 items-center justify-center rounded-full transition-transform active:scale-95 disabled:opacity-50',
                  state.recording ? 'bg-rose-500 text-white' : 'ed-ink'
                )}
                aria-label={state.recording ? 'Stop recording' : 'Start recording'}
              >
                {state.recording ? (
                  <Square className="h-8 w-8 fill-current" />
                ) : (
                  <Mic className="h-9 w-9" strokeWidth={1.8} />
                )}
              </button>
            </div>

            <p className="ed-num mt-4 text-[1.75rem] font-semibold leading-none text-[var(--home-heading)]">
              {formatDuration(hasTake ? state.durationSec : state.elapsed)}
            </p>
            <p className="mt-1.5 text-xs text-[var(--home-muted)]">
              {state.recording
                ? 'Recording — tap the square when you finish'
                : hasTake
                  ? 'Listen back, then publish it'
                  : 'Tap the microphone and begin reciting'}
            </p>

            {state.error ? (
              <p className="mt-3 text-xs font-medium text-rose-500">{state.error}</p>
            ) : null}

            {hasTake ? (
              <div className="mt-4 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={togglePreview}
                  className="ed-focus flex h-11 items-center gap-2 rounded-full border border-[var(--home-rule-strong)] px-4 text-sm font-semibold text-[var(--home-heading)] transition-colors hover:bg-[var(--home-track)]"
                >
                  {previewing ? (
                    <Pause className="h-4 w-4 fill-current" />
                  ) : (
                    <Play className="h-4 w-4 fill-current" />
                  )}
                  {previewing ? 'Pause' : 'Listen back'}
                </button>
                <button
                  type="button"
                  onClick={discard}
                  className="ed-focus flex h-11 items-center gap-2 rounded-full border border-[var(--home-rule-strong)] px-4 text-sm font-semibold text-[var(--home-muted)] transition-colors hover:text-[var(--home-heading)]"
                >
                  <RotateCcw className="h-4 w-4" />
                  Again
                </button>
              </div>
            ) : null}
          </section>

          {/* What was recited */}
          <section className={cn('mt-4 space-y-3', !hasTake && 'pointer-events-none opacity-45')}>
            <div className="ed-card rounded-[1.5rem] p-4">
              <label
                htmlFor="qari-surah"
                className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-[var(--home-muted)]"
              >
                Surah
              </label>
              <select
                id="qari-surah"
                value={surahId}
                onChange={(e) => setSurahId(Number(e.target.value))}
                className="ed-focus h-11 w-full rounded-xl border border-[var(--home-rule-strong)] bg-[var(--app-surface)] px-3 text-sm font-medium text-[var(--home-heading)]"
              >
                {chapters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.id}. {c.englishName}
                  </option>
                ))}
              </select>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="qari-from"
                    className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-[var(--home-muted)]"
                  >
                    From ayah
                  </label>
                  <input
                    id="qari-from"
                    type="number"
                    min={1}
                    max={maxAyah}
                    value={fromAyah}
                    onChange={(e) => setFromAyah(Number(e.target.value))}
                    className="ed-focus ed-num h-11 w-full rounded-xl border border-[var(--home-rule-strong)] bg-[var(--app-surface)] px-3 text-sm font-medium text-[var(--home-heading)]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="qari-to"
                    className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-[var(--home-muted)]"
                  >
                    To ayah
                  </label>
                  <input
                    id="qari-to"
                    type="number"
                    min={1}
                    max={maxAyah}
                    value={toAyah}
                    onChange={(e) => setToAyah(Number(e.target.value))}
                    className="ed-focus ed-num h-11 w-full rounded-xl border border-[var(--home-rule-strong)] bg-[var(--app-surface)] px-3 text-sm font-medium text-[var(--home-heading)]"
                  />
                </div>
              </div>

              <label
                htmlFor="qari-caption"
                className="mb-1.5 mt-3 block text-[10px] font-semibold uppercase tracking-wider text-[var(--home-muted)]"
              >
                Note <span className="font-normal normal-case">(optional)</span>
              </label>
              <textarea
                id="qari-caption"
                value={caption}
                onChange={(e) => setCaption(e.target.value.slice(0, 280))}
                rows={2}
                placeholder="Anything you'd like to say about this recitation"
                className="ed-focus w-full resize-none rounded-xl border border-[var(--home-rule-strong)] bg-[var(--app-surface)] px-3 py-2.5 text-sm text-[var(--home-heading)] placeholder:text-[var(--home-muted)]"
              />
            </div>

            <button
              type="button"
              onClick={() => void handlePublish()}
              disabled={publishing || !hasTake}
              className="ed-ink ed-focus flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold transition-transform active:scale-[0.98] disabled:opacity-60"
            >
              {publishing ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {publishing ? 'Publishing…' : viewer ? 'Publish recitation' : 'Sign in to publish'}
            </button>

            <p className="px-2 text-center text-[11px] leading-relaxed text-[var(--home-muted)]">
              Everyone can hear what you publish. Recite carefully — and you can delete it at any
              time from your profile.
            </p>
          </section>
        </>
      )}

      <AccountSheet open={accountOpen} onClose={() => setAccountOpen(false)} onSuccess={() => {}} />
      <Notice message={notice} />
    </QariScreen>
  )
}
