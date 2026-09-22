'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronRight, Download, Film, LayoutGrid, Link2, Music2, RotateCcw, Share2, X } from 'lucide-react'
import { prefetchRecitationAudio, type Recitation } from '@/lib/qari'
import {
  canMakeVideo,
  canShareMedia,
  copyText,
  DEFAULT_VIDEO_OPTIONS,
  loadVideoOptions,
  makeRecitationAudio,
  makeRecitationVideo,
  recitationLink,
  saveMedia,
  saveVideoOptions,
  shareMedia,
  ShareCancelled,
  FEATURED_VIDEO_BACKGROUND_IDS,
  VIDEO_BACKGROUND_GROUPS,
  VIDEO_BACKGROUNDS,
  type ShareKind,
  type ShareMedia,
  type VideoOptions,
} from '@/lib/qari-share-media'
import Switch from '@/components/qari/Switch'
import BackgroundGallery from '@/components/share/BackgroundGallery'
import { successFeedback, tapFeedback } from '@/lib/haptics'
import { tr, useT } from '@/lib/i18n'

type Stage =
  | { name: 'choose' }
  | { name: 'customize' }
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
  const t = useT()
  const [stage, setStage] = useState<Stage>({ name: 'choose' })
  const [videoOptions, setVideoOptions] = useState<VideoOptions>(DEFAULT_VIDEO_OPTIONS)
  const abortRef = useRef<AbortController | null>(null)
  const videoPossible = useMemo(() => (open ? canMakeVideo() : true), [open])

  useEffect(() => {
    if (!open) return
    setStage({ name: 'choose' })
    setVideoOptions(loadVideoOptions())
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

      if (kind === 'video') saveVideoOptions(videoOptions)
      try {
        const media =
          kind === 'video'
            ? await makeRecitationVideo(recitation, onProgress, controller.signal, videoOptions)
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
                ? tr('Could not make the video.')
                : tr('Could not prepare the audio.'),
        })
      }
    },
    [recitation, videoOptions]
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
          onNotice?.(media.kind === 'video' ? tr('Video saved to your phone.') : tr('Audio saved to your phone.'))
        } else {
          close()
        }
      } catch {
        // The sheet refused this file — saving always works.
        saveMedia(media)
        onNotice?.(tr('Saved to your phone instead.'))
      }
    },
    [close, onNotice, recitation]
  )

  const handleCopy = useCallback(async () => {
    tapFeedback()
    const ok = await copyText(`${recitation.userName} — ${recitation.title}\n${recitationLink(recitation)}`)
    onNotice?.(ok ? tr('Link copied.') : tr('Could not copy the link.'))
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
        className="qari-sheet__panel relative w-full max-w-md rounded-t-[1.75rem] bg-[var(--home-card-bg)] px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-[var(--home-card-shadow)] sm:rounded-[1.75rem]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--home-rule-strong)] sm:hidden" aria-hidden />

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="qari-share-title" className="home-serif text-[1.3125rem] font-semibold leading-tight text-[var(--home-heading)]">
              {stage.name === 'ready'
                ? stage.media.kind === 'video'
                  ? t('Your video is ready')
                  : t('Your audio is ready')
                : t('Share recitation')}
            </h2>
            <p className="mt-0.5 truncate text-[0.82rem] text-[var(--home-muted)]">
              {recitation.title} · {recitation.userName}
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label={t('Close')}
            className="ed-focus -mr-1.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--home-muted)] transition-colors hover:bg-[var(--home-track)] hover:text-[var(--home-heading)]"
          >
            <X className="h-[18px] w-[18px]" strokeWidth={2} />
          </button>
        </div>

        {stage.name === 'choose' ? (
          <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--home-rule)]">
            <ShareOption
              icon={Film}
              title={t('Video')}
              hint={videoPossible ? t('For TikTok, Instagram and Status') : t('Needs a newer Chrome or Safari')}
              disabled={!videoPossible}
              onClick={() => {
                tapFeedback()
                setStage({ name: 'customize' })
              }}
            />
            <div className="set-row__divider" />
            <ShareOption
              icon={Music2}
              title={t('Audio')}
              hint={t('An MP3 for WhatsApp or Telegram')}
              onClick={() => void make('audio')}
            />
            <div className="set-row__divider" />
            <button type="button" onClick={() => void handleCopy()} className="set-row">
              <span className="set-row__icon">
                <Link2 className="h-[17px] w-[17px]" strokeWidth={1.9} />
              </span>
              <span className="set-row__label">{t('Copy link')}</span>
              <span className="text-sm font-semibold text-[var(--home-sage-deep)] dark:text-[var(--home-sage)]">{t('Copy')}</span>
            </button>
          </div>
        ) : null}

        {stage.name === 'customize' ? (
          <CustomizeVideo
            options={videoOptions}
            onChange={setVideoOptions}
            onBack={() => setStage({ name: 'choose' })}
            onMake={() => void make('video')}
          />
        ) : null}

        {stage.name === 'working' ? (
          <div className="mt-6 pb-1">
            <div className="flex items-baseline justify-between">
              <p className="text-sm font-semibold text-[var(--home-heading)]">
                {stage.kind === 'video' ? t('Making your video…') : t('Preparing the audio…')}
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
              {t('Keep the app open. Longer recitations take a little longer.')}</p>
            <button
              type="button"
              onClick={cancel}
              className="ed-focus mt-4 h-11 w-full rounded-full border border-[var(--home-rule-strong)] text-sm font-semibold text-[var(--home-heading)] transition-colors hover:bg-[var(--home-track)]"
            >
              {t('Cancel')}</button>
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
                  ? tr('Saved. Upload it to TikTok from your gallery.')
                  : tr('Audio saved to your phone.')
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
                {t('Back')}</button>
              <button
                type="button"
                onClick={() => void make(stage.kind)}
                className="ed-ink ed-focus flex h-11 flex-1 items-center justify-center gap-2 rounded-full text-sm font-semibold transition-transform active:scale-[0.98]"
              >
                <RotateCcw className="h-4 w-4" strokeWidth={2} />
                {t('Try again')}</button>
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
    <button type="button" onClick={onClick} disabled={disabled} className="set-row" style={{ paddingBlock: '0.5625rem' }}>
      <span className="set-row__icon">
        <Icon className="h-[17px] w-[17px]" strokeWidth={1.9} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium">{title}</span>
        <span className="mt-px block truncate text-[12.5px] text-[var(--home-muted)]">{hint}</span>
      </span>
      <ChevronRight className="h-[17px] w-[17px] shrink-0 text-[var(--home-muted)]" strokeWidth={2} />
    </button>
  )
}

function CustomizeVideo({
  options,
  onChange,
  onBack,
  onMake,
}: {
  options: VideoOptions
  onChange: (options: VideoOptions) => void
  onBack: () => void
  onMake: () => void
}) {
  const t = useT()
  const [galleryOpen, setGalleryOpen] = useState(false)
  // A few to pick from at a glance; the one in use is always among them.
  const featured = VIDEO_BACKGROUNDS.filter((b) => FEATURED_VIDEO_BACKGROUND_IDS.includes(b.id))
  const chosen = VIDEO_BACKGROUNDS.find((b) => b.id === options.backgroundId)
  const strip = chosen && !featured.includes(chosen) ? [chosen, ...featured] : featured
  return (
    <div className="mt-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--home-muted)]">{t('Background')}</p>
      <div className="qari-no-scrollbar mt-2 flex gap-2.5 overflow-x-auto pb-1">
        {strip.map((background) => {
          const active = background.id === options.backgroundId
          return (
            <button
              key={background.id}
              type="button"
              onClick={() => {
                tapFeedback()
                onChange({ ...options, backgroundId: background.id })
              }}
              aria-pressed={active}
              className="qari-press ed-focus flex shrink-0 flex-col items-center gap-1.5"
            >
              <span
                className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-black bg-cover bg-center"
                style={{
                  backgroundImage: background.thumb ? `url(${background.thumb})` : undefined,
                  boxShadow: active
                    ? '0 0 0 2.5px var(--home-card-bg), 0 0 0 4.5px var(--home-sage)'
                    : '0 0 0 1px var(--home-rule)',
                }}
              />
              <span className="text-[11px] font-medium text-[var(--home-muted)]">{t(background.label)}</span>
            </button>
          )
        })}
        <button
          type="button"
          onClick={() => {
            tapFeedback()
            setGalleryOpen(true)
          }}
          className="qari-press ed-focus flex shrink-0 flex-col items-center gap-1.5"
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--home-track)] text-[var(--home-heading)]">
            <LayoutGrid className="h-5 w-5" strokeWidth={1.9} />
          </span>
          <span className="text-[11px] font-medium text-[var(--home-muted)]">{t('More')}</span>
        </button>
      </div>
      <BackgroundGallery
        open={galleryOpen}
        items={VIDEO_BACKGROUNDS}
        groups={VIDEO_BACKGROUND_GROUPS}
        selectedId={options.backgroundId}
        onSelect={(id) => onChange({ ...options, backgroundId: id })}
        onClose={() => setGalleryOpen(false)}
      />

      <div className="set-row mt-4 rounded-2xl border border-[var(--home-rule)]" style={{ paddingBlock: '0.5rem' }}>
        <span className="set-row__label">{t('Include profile picture')}</span>
        <Switch
          checked={options.includeAvatar}
          onChange={(checked) => onChange({ ...options, includeAvatar: checked })}
          label={t('Include profile picture')}
        />
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onBack}
          className="ed-focus h-12 flex-1 rounded-full border border-[var(--home-rule-strong)] text-sm font-semibold text-[var(--home-heading)] transition-colors hover:bg-[var(--home-track)]"
        >
          {t('Back')}</button>
        <button
          type="button"
          onClick={onMake}
          className="ed-ink ed-focus flex h-12 flex-[1.4] items-center justify-center gap-2 rounded-full text-sm font-semibold transition-transform active:scale-[0.98]"
        >
          <Film className="h-4 w-4" strokeWidth={2} />
          {t('Make video')}</button>
      </div>
    </div>
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
  const t = useT()
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
            {t('Save')}</button>
        ) : null}
        <button
          type="button"
          onClick={shareable ? onShare : onSave}
          className="ed-ink ed-focus flex h-12 flex-[1.4] items-center justify-center gap-2 rounded-full text-sm font-semibold transition-transform active:scale-[0.98]"
        >
          {shareable ? <Share2 className="h-4 w-4" strokeWidth={2} /> : <Download className="h-4 w-4" strokeWidth={2} />}
          {shareable ? t('Share') : t('Save to phone')}
        </button>
      </div>

      <p className="mt-3 text-center text-xs leading-relaxed text-[var(--home-muted)]">
        {shareable
          ? media.kind === 'video'
            ? t('Pick TikTok in the share list, or save it and upload it from your gallery.')
            : t('Pick WhatsApp, Telegram or any app in the share list.')
          : media.kind === 'video'
            ? t('Save it, then upload it to TikTok or Instagram from your gallery.')
            : t('Save it, then send it from your downloads in any app.')}
      </p>
      <button
        type="button"
        onClick={onBack}
        className="ed-focus mx-auto mt-1 block h-10 px-4 text-xs font-semibold text-[var(--home-muted)] hover:text-[var(--home-heading)]"
      >
        {t('Make something else')}</button>
    </div>
  )
}
