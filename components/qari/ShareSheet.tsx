'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Download, Film, Link2, Music2, RotateCcw, Share2, X } from 'lucide-react'
import { prefetchRecitationAudio, type Recitation } from '@/lib/qari'
import {
  canMakeVideo,
  canShareMedia,
  copyText,
  makeRecitationAudio,
  makeRecitationVideo,
  recitationLink,
  saveMedia,
  shareMedia,
  ShareCancelled,
  type ShareKind,
  type ShareMedia,
} from '@/lib/qari-share-media'
import { successFeedback, tapFeedback } from '@/lib/haptics'
import { APP_NAME } from '@/lib/app-brand'
import { cn } from '@/lib/cn'

type Stage =
  | { name: 'choose' }
  | { name: 'working'; kind: ShareKind; progress: number }
  | { name: 'ready'; media: ShareMedia }
  | { name: 'error'; kind: ShareKind; message: string }

interface ShareSheetProps {
  recitation: Recitation
  open: boolean
  onClose: () => void
  onNotice?: (message: string) => void
}

/**
 * Share as a video (the one that travels: TikTok, Reels, Status, carrying the
 * app's name) or as audio, or just the link.
 *
 * Making the file and sharing it are two taps on purpose — a phone only opens
 * its share sheet inside a fresh tap, and making a video takes a few seconds.
 */
export default function ShareSheet({ recitation, open, onClose, onNotice }: ShareSheetProps) {
  const [stage, setStage] = useState<Stage>({ name: 'choose' })
  const abortRef = useRef<AbortController | null>(null)
  const videoPossible = useMemo(() => (open ? canMakeVideo() : true), [open])

  useEffect(() => {
    if (!open) return
    setStage({ name: 'choose' })
    // Start the download now; by the time an option is picked it is usually here.
    void prefetchRecitationAudio(recitation.id)
    return () => {
      abortRef.current?.abort()
      abortRef.current = null
    }
  }, [open, recitation.id])

  const previewUrl = useMemo(
    () => (stage.name === 'ready' ? URL.createObjectURL(stage.media.blob) : null),
    [stage]
  )
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const make = useCallback(
    async (kind: ShareKind) => {
      tapFeedback()
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      setStage({ name: 'working', kind, progress: 0 })

      const onProgress = (progress: number) => {
        if (!controller.signal.aborted) setStage({ name: 'working', kind, progress })
      }

      try {
        const media =
          kind === 'video'
            ? await makeRecitationVideo(recitation, onProgress, controller.signal)
            : await makeRecitationAudio(recitation, onProgress, controller.signal)
        if (controller.signal.aborted) return
        successFeedback()
        setStage({ name: 'ready', media })
      } catch (err) {
        if (err instanceof ShareCancelled || controller.signal.aborted) return
        setStage({
          name: 'error',
          kind,
          message:
            err instanceof Error && err.message
              ? err.message
              : kind === 'video'
                ? 'Could not make the video.'
                : 'Could not prepare the audio.',
        })
      }
    },
    [recitation]
  )

  const cancel = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setStage({ name: 'choose' })
  }, [])

  const close = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    onClose()
  }, [onClose])

  const handleShare = useCallback(
    async (media: ShareMedia) => {
      try {
        const result = await shareMedia(media, recitation)
        if (result === 'saved') {
          onNotice?.(media.kind === 'video' ? 'Video saved to your phone.' : 'Audio saved to your phone.')
        } else {
          close()
        }
      } catch {
        // The sheet refused this file — saving always works.
        saveMedia(media)
        onNotice?.('Saved to your phone instead.')
      }
    },
    [close, onNotice, recitation]
  )

  const handleCopy = useCallback(async () => {
    tapFeedback()
    const ok = await copyText(`${recitation.userName} — ${recitation.title}\n${recitationLink(recitation)}`)
    onNotice?.(ok ? 'Link copied.' : 'Could not copy the link.')
    if (ok) close()
  }, [close, onNotice, recitation])

  if (!open || typeof document === 'undefined') return null

  // Rendered on the page itself: a card that animates in has its own layer,
  // and a sheet left inside it would sit under the cards that follow.
  return createPortal(
    <div
      className="qari-sheet fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="qari-share-title"
      onClick={close}
    >
      <div
        className="qari-sheet__panel relative w-full max-w-md rounded-t-[1.75rem] border border-[var(--home-card-border)] bg-[var(--home-card-bg)] px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-[var(--home-card-shadow)] sm:rounded-[1.75rem]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--home-rule-strong)] sm:hidden" aria-hidden />

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="qari-share-title" className="text-[1.05rem] font-bold text-[var(--home-heading)]">
              {stage.name === 'ready'
                ? stage.media.kind === 'video'
                  ? 'Your video is ready'
                  : 'Your audio is ready'
                : 'Share recitation'}
            </h2>
            <p className="mt-0.5 truncate text-[0.82rem] text-[var(--home-muted)]">
              {recitation.title} · {recitation.userName}
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="ed-focus -mr-1.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--home-muted)] transition-colors hover:bg-[var(--home-track)] hover:text-[var(--home-heading)]"
          >
            <X className="h-[18px] w-[18px]" strokeWidth={2} />
          </button>
        </div>

        {stage.name === 'choose' ? (
          <div className="mt-4 space-y-2.5">
            <ShareOption
              icon={Film}
              title="Video"
              hint={
                videoPossible
                  ? `For TikTok, Instagram and Status. Shows ${APP_NAME} and the qari's name.`
                  : 'Needs a newer browser. Update Chrome or Safari to make videos.'
              }
              disabled={!videoPossible}
              onClick={() => void make('video')}
            />
            <ShareOption
              icon={Music2}
              title="Audio"
              hint="An MP3 you can send on WhatsApp, Telegram or anywhere."
              onClick={() => void make('audio')}
            />
            <button
              type="button"
              onClick={() => void handleCopy()}
              className="ed-focus flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold text-[var(--home-heading)] transition-colors hover:bg-[var(--home-track)]"
            >
              <Link2 className="h-4 w-4" strokeWidth={2} />
              Copy link
            </button>
          </div>
        ) : null}

        {stage.name === 'working' ? (
          <div className="mt-6 pb-1">
            <div className="flex items-baseline justify-between">
              <p className="text-sm font-semibold text-[var(--home-heading)]">
                {stage.kind === 'video' ? 'Making your video…' : 'Preparing the audio…'}
              </p>
              <span className="text-sm font-semibold tabular-nums text-[var(--home-sage)]">
                {Math.round(stage.progress * 100)}%
              </span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--home-track)]">
              <div
                className="h-full rounded-full bg-[var(--home-sage)] transition-[width] duration-200 ease-out"
                style={{ width: `${Math.max(3, stage.progress * 100)}%` }}
              />
            </div>
            <p className="mt-3 text-xs leading-relaxed text-[var(--home-muted)]">
              Keep the app open. Longer recitations take a little longer.
            </p>
            <button
              type="button"
              onClick={cancel}
              className="ed-focus mt-4 h-11 w-full rounded-full border border-[var(--home-rule-strong)] text-sm font-semibold text-[var(--home-heading)] transition-colors hover:bg-[var(--home-track)]"
            >
              Cancel
            </button>
          </div>
        ) : null}

        {stage.name === 'ready' && previewUrl ? (
          <ReadyView
            media={stage.media}
            previewUrl={previewUrl}
            onShare={() => void handleShare(stage.media)}
            onSave={() => {
              tapFeedback()
              saveMedia(stage.media)
              onNotice?.(
                stage.media.kind === 'video'
                  ? 'Saved. Upload it to TikTok from your gallery.'
                  : 'Audio saved to your phone.'
              )
            }}
            onBack={() => setStage({ name: 'choose' })}
          />
        ) : null}

        {stage.name === 'error' ? (
          <div className="mt-5">
            <p className="rounded-2xl bg-[var(--home-track)] px-4 py-3 text-sm leading-relaxed text-[var(--home-heading)]">
              {stage.message}
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setStage({ name: 'choose' })}
                className="ed-focus h-11 flex-1 rounded-full border border-[var(--home-rule-strong)] text-sm font-semibold text-[var(--home-heading)] transition-colors hover:bg-[var(--home-track)]"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => void make(stage.kind)}
                className="ed-ink ed-focus flex h-11 flex-1 items-center justify-center gap-2 rounded-full text-sm font-semibold transition-transform active:scale-[0.98]"
              >
                <RotateCcw className="h-4 w-4" strokeWidth={2} />
                Try again
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>,
    document.body
  )
}

function ShareOption({
  icon: Icon,
  title,
  hint,
  disabled,
  onClick,
}: {
  icon: typeof Film
  title: string
  hint: string
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'ed-focus flex w-full items-center gap-3.5 rounded-2xl border border-[var(--home-rule-strong)] p-3.5 text-left transition-[background-color,transform] active:scale-[0.99]',
        disabled ? 'opacity-55' : 'hover:bg-[var(--home-track)]'
      )}
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--home-sage-soft)] text-[var(--home-sage)]">
        <Icon className="h-5 w-5" strokeWidth={2} />
      </span>
      <span className="min-w-0">
        <span className="block text-[0.95rem] font-semibold text-[var(--home-heading)]">{title}</span>
        <span className="mt-0.5 block text-xs leading-snug text-[var(--home-muted)]">{hint}</span>
      </span>
    </button>
  )
}

function ReadyView({
  media,
  previewUrl,
  onShare,
  onSave,
  onBack,
}: {
  media: ShareMedia
  previewUrl: string
  onShare: () => void
  onSave: () => void
  onBack: () => void
}) {
  const shareable = canShareMedia(media)

  return (
    <div className="mt-4">
      {media.kind === 'video' ? (
        <video
          src={previewUrl}
          className="mx-auto block aspect-[9/16] max-h-[46vh] rounded-2xl bg-black"
          controls
          playsInline
          autoPlay
          muted
          loop
        />
      ) : (
        <audio src={previewUrl} controls className="w-full" />
      )}

      <div className="mt-4 flex gap-2">
        {shareable ? (
          <button
            type="button"
            onClick={onSave}
            className="ed-focus flex h-12 flex-1 items-center justify-center gap-2 rounded-full border border-[var(--home-rule-strong)] text-sm font-semibold text-[var(--home-heading)] transition-colors hover:bg-[var(--home-track)]"
          >
            <Download className="h-4 w-4" strokeWidth={2} />
            Save
          </button>
        ) : null}
        <button
          type="button"
          onClick={shareable ? onShare : onSave}
          className="ed-ink ed-focus flex h-12 flex-[1.4] items-center justify-center gap-2 rounded-full text-sm font-semibold transition-transform active:scale-[0.98]"
        >
          {shareable ? <Share2 className="h-4 w-4" strokeWidth={2} /> : <Download className="h-4 w-4" strokeWidth={2} />}
          {shareable ? 'Share' : 'Save to phone'}
        </button>
      </div>

      <p className="mt-3 text-center text-xs leading-relaxed text-[var(--home-muted)]">
        {shareable
          ? media.kind === 'video'
            ? 'Pick TikTok in the share list, or save it and upload it from your gallery.'
            : 'Pick WhatsApp, Telegram or any app in the share list.'
          : media.kind === 'video'
            ? 'Save it, then upload it to TikTok or Instagram from your gallery.'
            : 'Save it, then send it from your downloads in any app.'}
      </p>
      <button
        type="button"
        onClick={onBack}
        className="ed-focus mx-auto mt-1 block h-10 px-4 text-xs font-semibold text-[var(--home-muted)] hover:text-[var(--home-heading)]"
      >
        Make something else
      </button>
    </div>
  )
}
