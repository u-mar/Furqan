'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Globe, Hash, Lock, Mic, Pause, Play, RotateCcw, Send, Square } from 'lucide-react'
import { Notice, QariHeader, QariScreen, useNotice, useViewer } from '@/components/qari/QariShell'
import AccountSheet from '@/components/settings/AccountSheet'
import { useQariRecorder } from '@/hooks/useQariRecorder'
import { createSpaceMixer, findSpace, SPACES, type SpaceId, type SpaceMixer } from '@/lib/audio-space'
import { formatDuration, publishRecitation } from '@/lib/qari'
import { cn } from '@/lib/cn'

/** Centre-heavy weights, so the meter moves like a voice rather than a wall. */
const LEVEL_BARS = [0.45, 0.7, 0.95, 1, 0.95, 0.7, 0.45]

export default function QariRecordPage() {
  const router = useRouter()
  const viewer = useViewer()
  const { notice, setNotice } = useNotice()
  const [spaceId, setSpaceId] = useState<SpaceId>('reciter')
  const { state, start, stop, reset, supported } = useQariRecorder()

  const [title, setTitle] = useState('')
  const [hashtags, setHashtags] = useState('')
  const [caption, setCaption] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)

  const previewRef = useRef<HTMLAudioElement | null>(null)
  const previewCtxRef = useRef<AudioContext | null>(null)
  const mixerRef = useRef<SpaceMixer | null>(null)
  const [previewing, setPreviewing] = useState(false)

  /* Changing the filter takes effect at once — even mid-playback. */
  useEffect(() => {
    mixerRef.current?.setSpace(findSpace(spaceId))
  }, [spaceId])

  useEffect(() => {
    return () => {
      previewRef.current?.pause()
      if (previewRef.current?.src) URL.revokeObjectURL(previewRef.current.src)
      previewRef.current = null
      void previewCtxRef.current?.close().catch(() => {})
      previewCtxRef.current = null
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

      // Routed through the mixer so the preview is exactly what a listener
      // will hear, and so the filter can be swapped without re-recording.
      const ctx = new AudioContext()
      previewCtxRef.current = ctx
      const mixer = createSpaceMixer(ctx, ctx.createMediaElementSource(audio))
      mixer.output.connect(ctx.destination)
      mixer.setSpace(findSpace(spaceId))
      mixerRef.current = mixer
    }

    void previewCtxRef.current?.resume().catch(() => {})
    void previewRef.current.play().catch(() => setNotice('Could not play that back.'))
  }, [previewing, setNotice, spaceId, state.blob])

  const discard = useCallback(() => {
    previewRef.current?.pause()
    if (previewRef.current?.src) URL.revokeObjectURL(previewRef.current.src)
    previewRef.current = null
    mixerRef.current = null
    void previewCtxRef.current?.close().catch(() => {})
    previewCtxRef.current = null
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
        space: spaceId,
        hashtags: hashtags.trim(),
        isPrivate,
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
    hashtags,
    isPrivate,
    router,
    spaceId,
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

          {/* How it should sound — applied as you record, so it has to be
              chosen first. */}
          <section className="ed-card mt-4 rounded-[1.5rem] p-4">
            <div className="mb-2.5 flex items-baseline justify-between gap-2">
              <p className="qari-field-label mb-0">Sound</p>
              {hasTake ? (
                <span className="text-[11px] text-[var(--home-muted)]">
                  Listen back to compare
                </span>
              ) : null}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {SPACES.map((space) => (
                <button
                  key={space.id}
                  type="button"
                  onClick={() => setSpaceId(space.id)}
                  aria-pressed={spaceId === space.id}
                  className={cn(
                    'ed-focus rounded-2xl border px-2.5 py-2.5 text-left transition-colors',
                    spaceId === space.id
                      ? 'border-[var(--home-sage-deep)] bg-[var(--home-sage-soft)]'
                      : 'border-[var(--home-rule-strong)] hover:bg-[var(--home-track)]'
                  )}
                >
                  <span className="block text-[0.82rem] font-semibold text-[var(--home-heading)]">
                    {space.label}
                  </span>
                  <span className="mt-0.5 block text-[10px] leading-snug text-[var(--home-muted)]">
                    {space.hint}
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-2.5 text-[11px] leading-relaxed text-[var(--home-muted)]">
              Hold the phone about a hand's width away, in the quietest room you have — no
              processing can undo noise that was there when you recorded.
            </p>
          </section>

          {/* Details */}
          <section className={cn('mt-4 space-y-3', !hasTake && 'pointer-events-none opacity-45')}>
            <div className="ed-card rounded-[1.5rem] p-4">
              <label htmlFor="qari-title" className="qari-field-label">
                Title
              </label>
              <input
                id="qari-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, 80))}
                placeholder="Al-Mulk, first ten ayat"
                className="qari-field"
              />

              <label htmlFor="qari-tags" className="qari-field-label mt-4">
                Hashtags <span className="font-normal normal-case">(optional)</span>
              </label>
              <div className="relative">
                <Hash
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--home-muted)]"
                  aria-hidden
                />
                <input
                  id="qari-tags"
                  type="text"
                  value={hashtags}
                  onChange={(e) => setHashtags(e.target.value.slice(0, 200))}
                  placeholder="tajweed  hifdh  fajr"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className="qari-field qari-field--icon"
                />
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--home-muted)]">
                Up to six, separated by spaces. People can tap one to find more like it.
              </p>

              <label htmlFor="qari-caption" className="qari-field-label mt-4">
                Note <span className="font-normal normal-case">(optional)</span>
              </label>
              <textarea
                id="qari-caption"
                value={caption}
                onChange={(e) => setCaption(e.target.value.slice(0, 280))}
                rows={2}
                placeholder="Anything you'd like to say about this recitation"
                className="qari-field resize-none py-2.5 leading-snug"
              />
            </div>

            {/* Who can hear it */}
            <div className="ed-card rounded-[1.5rem] p-4">
              <p className="qari-field-label">Who can hear it</p>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    {
                      value: false,
                      Icon: Globe,
                      label: 'Everyone',
                      hint: 'Appears in the feed',
                    },
                    {
                      value: true,
                      Icon: Lock,
                      label: 'Only me',
                      hint: 'Kept on your profile',
                    },
                  ] as const
                ).map(({ value, Icon, label, hint }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setIsPrivate(value)}
                    aria-pressed={isPrivate === value}
                    className={cn(
                      'ed-focus rounded-2xl border p-3 text-left transition-colors',
                      isPrivate === value
                        ? 'border-[var(--home-sage-deep)] bg-[var(--home-sage-soft)]'
                        : 'border-[var(--home-rule-strong)] hover:bg-[var(--home-track)]'
                    )}
                  >
                    <Icon
                      className={cn(
                        'h-[18px] w-[18px]',
                        isPrivate === value
                          ? 'text-[var(--home-sage-deep)]'
                          : 'text-[var(--home-muted)]'
                      )}
                      strokeWidth={2}
                    />
                    <span className="mt-1.5 block text-[0.85rem] font-semibold text-[var(--home-heading)]">
                      {label}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-[var(--home-muted)]">
                      {hint}
                    </span>
                  </button>
                ))}
              </div>
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
              {publishing
                ? 'Publishing…'
                : !viewer
                  ? 'Sign in to publish'
                  : isPrivate
                    ? 'Save to my profile'
                    : 'Publish recitation'}
            </button>

            <p className="px-2 text-center text-[11px] leading-relaxed text-[var(--home-muted)]">
              {isPrivate
                ? 'Only you will be able to hear this. You can delete it at any time from your profile.'
                : 'Everyone can hear what you publish. Recite carefully — and you can delete it at any time from your profile.'}
            </p>
          </section>
        </>
      )}

      <AccountSheet open={accountOpen} onClose={() => setAccountOpen(false)} onSuccess={() => {}} />
      <Notice message={notice} />
    </QariScreen>
  )
}
