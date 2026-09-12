'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Mic, Pause, Play, RotateCcw, Send, Square } from 'lucide-react'
import { Notice, QariHeader, QariScreen, useNotice, useViewer } from '@/components/qari/QariShell'
import AccountSheet from '@/components/settings/AccountSheet'
import { useQariRecorder } from '@/hooks/useQariRecorder'
import { formatDuration, publishRecitation } from '@/lib/qari'
import { cn } from '@/lib/cn'

/** Centre-heavy weights, so the meter moves like a voice rather than a wall. */
const LEVEL_BARS = [0.45, 0.7, 0.95, 1, 0.95, 0.7, 0.45]

export default function QariRecordPage() {
  const router = useRouter()
  const viewer = useViewer()
  const { notice, setNotice } = useNotice()
  const { state, start, stop, reset, supported } = useQariRecorder()

  const [title, setTitle] = useState('')
  const [caption, setCaption] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)

  const previewRef = useRef<HTMLAudioElement | null>(null)
  const [previewing, setPreviewing] = useState(false)

  useEffect(() => {
    return () => {
      previewRef.current?.pause()
      if (previewRef.current?.src) URL.revokeObjectURL(previewRef.current.src)
      previewRef.current = null
    }
  }, [])

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
    if (!title.trim()) {
      setNotice('Give your recitation a title.')
      return
    }

    setPublishing(true)
    try {
      await publishRecitation({
        blob: state.blob,
        mimeType: state.mimeType,
        durationSec: state.durationSec,
        title: title.trim(),
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
    router,
    setNotice,
    state.blob,
    state.durationSec,
    state.mimeType,
    title,
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
          <section className="ed-card rounded-[1.75rem] px-5 pb-6 pt-7 text-center">
            <div className="relative mx-auto flex h-40 w-40 items-center justify-center">
              {/* Two rings that swell with your voice. Inline transforms so
                  the level reads the same in every theme. */}
              <span
                className="absolute rounded-full bg-[var(--home-sage-soft)] transition-transform duration-75"
                style={{
                  inset: 0,
                  transform: `scale(${state.recording ? 0.88 + state.level * 0.42 : 0.78})`,
                  opacity: state.recording ? 1 : 0.65,
                }}
                aria-hidden
              />
              <span
                className="absolute rounded-full border border-[var(--home-sage-deep)] transition-transform duration-100"
                style={{
                  inset: 0,
                  transform: `scale(${state.recording ? 0.96 + state.level * 0.26 : 0.8})`,
                  opacity: state.recording ? 0.5 : 0,
                }}
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

            <p className="ed-num mt-5 text-[2rem] font-semibold leading-none text-[var(--home-heading)]">
              {formatDuration(hasTake ? state.durationSec : state.elapsed)}
            </p>

            {/* Live level meter — proof the microphone is hearing you. */}
            {state.recording ? (
              <span className="mx-auto mt-3 flex h-5 items-end justify-center gap-[3px]" aria-hidden>
                {LEVEL_BARS.map((weight, i) => (
                  <span
                    key={i}
                    className="w-[3px] rounded-full bg-[var(--home-sage-deep)] transition-[height] duration-75"
                    style={{
                      height: `${Math.max(4, Math.min(20, 4 + state.level * 48 * weight))}px`,
                    }}
                  />
                ))}
              </span>
            ) : null}

            <p className="mt-3 text-xs text-[var(--home-muted)]">
              {state.recording
                ? 'Listening — tap the square when you finish'
                : hasTake
                  ? 'Listen back, then publish it'
                  : 'Tap the microphone and begin reciting'}
            </p>

            {state.error ? (
              <p className="mt-3 text-xs font-medium text-rose-500">{state.error}</p>
            ) : null}

            {hasTake ? (
              <div className="mt-5 flex items-center justify-center gap-2">
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

          {/* Title and note */}
          <section className={cn('mt-4 space-y-3', !hasTake && 'pointer-events-none opacity-45')}>
            <div className="ed-card rounded-[1.5rem] p-4">
              <label
                htmlFor="qari-title"
                className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-[var(--home-muted)]"
              >
                Title
              </label>
              <input
                id="qari-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, 80))}
                placeholder="Al-Mulk, first ten ayat"
                className="ed-focus h-11 w-full rounded-xl border border-[var(--home-rule-strong)] bg-[var(--app-surface)] px-3 text-sm font-medium text-[var(--home-heading)] placeholder:font-normal placeholder:text-[var(--home-muted)]"
              />

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
