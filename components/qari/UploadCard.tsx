'use client'

import { AlertCircle, Check, RotateCw, X } from 'lucide-react'
import BackgroundCover from '@/components/qari/BackgroundCover'
import { findVideoBackground } from '@/lib/qari-backgrounds'
import { dismissUpload, retryUpload, type QariUpload } from '@/lib/qari-upload'
import { tapFeedback } from '@/lib/haptics'
import { cn } from '@/lib/cn'
import { useT } from '@/lib/i18n'

const RING_R = 15
const RING_C = 2 * Math.PI * RING_R

/**
 * A post on its way up, at the top of its owner's profile: its cover
 * with the percentage over it, until it is posted and joins the list below —
 * or, if it failed, with the way to try again.
 */
export default function UploadCard({ upload }: { upload: QariUpload }) {
  const t = useT()
  const percent = Math.round(upload.progress * 100)
  const sending = upload.stage === 'marking' || upload.stage === 'uploading' || upload.stage === 'processing'

  return (
    <div className="qari-card qari-enter flex items-center gap-3 px-3 py-3" role="status" aria-live="polite">
      <div className="relative aspect-[9/16] w-[3.25rem] shrink-0 overflow-hidden rounded-[10px]">
        {'image' in upload.cover ? (
          <img src={upload.cover.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <BackgroundCover background={findVideoBackground(upload.cover.background)} small />
        )}
        <span className={cn('absolute inset-0 transition-colors', upload.stage === 'done' ? 'bg-black/25' : 'bg-black/50')} />
        <span className="absolute inset-0 flex items-center justify-center text-white">
          {upload.stage === 'uploading' || upload.stage === 'marking' ? (
            <span className="relative flex h-9 w-9 items-center justify-center">
              <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90" aria-hidden>
                <circle cx="18" cy="18" r={RING_R} fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="2.5" />
                <circle
                  cx="18"
                  cy="18"
                  r={RING_R}
                  fill="none"
                  stroke="#fff"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeDasharray={RING_C}
                  strokeDashoffset={RING_C * (1 - upload.progress)}
                  className="transition-[stroke-dashoffset] duration-200"
                />
              </svg>
              <span className="text-[10px] font-bold tabular-nums">{percent}%</span>
            </span>
          ) : upload.stage === 'processing' ? (
            <span className="h-6 w-6 animate-spin rounded-full border-[2.5px] border-white/30 border-t-white" />
          ) : upload.stage === 'done' ? (
            <span className="qari-done flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#0d6b63]">
              <Check className="h-[18px] w-[18px]" strokeWidth={3} />
            </span>
          ) : (
            <AlertCircle className="h-6 w-6 text-rose-200" strokeWidth={2.2} />
          )}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <p className="home-serif truncate text-[16px] font-medium text-[var(--home-heading)]">{upload.title}</p>
        <p
          className={cn(
            'mt-0.5 text-[12.5px]',
            upload.stage === 'failed' ? 'line-clamp-2 text-rose-600 dark:text-rose-300' : 'truncate text-[var(--home-muted)]'
          )}
        >
          {upload.stage === 'marking'
            ? t('Marking ayat… {percent}%', { percent })
            : upload.stage === 'uploading'
            ? t('Posting… {percent}%', { percent })
            : upload.stage === 'processing'
              ? t('Finishing up…')
              : upload.stage === 'done'
                ? upload.isPrivate
                  ? t('Saved to your profile')
                  : t('Posted')
                : upload.error || t('Could not post')}
        </p>
        {sending ? (
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-[var(--home-track)]">
            <div
              className={cn(
                'h-full rounded-full bg-[var(--home-sage)] transition-[width] duration-200',
                upload.stage === 'processing' && 'animate-pulse'
              )}
              style={{ width: `${Math.max(3, percent)}%` }}
            />
          </div>
        ) : upload.stage === 'failed' ? (
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                tapFeedback()
                retryUpload(upload.key)
              }}
              className="ed-ink ed-focus qari-press flex h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold"
            >
              <RotateCw className="h-3.5 w-3.5" strokeWidth={2.4} />
              {t('Try again')}
            </button>
            <button
              type="button"
              onClick={() => {
                tapFeedback()
                dismissUpload(upload.key)
              }}
              className="ed-focus flex h-8 items-center gap-1 rounded-full px-2.5 text-[12.5px] font-medium text-[var(--home-muted)] hover:text-[var(--home-heading)]"
            >
              <X className="h-3.5 w-3.5" strokeWidth={2.4} />
              {t('Dismiss')}
            </button>
          </div>
        ) : null}
        {upload.stage === 'failed' ? (
          <p className="mt-1.5 text-[11.5px] text-[var(--home-muted)]">{t('It stays in your drafts too.')}</p>
        ) : null}
      </div>
    </div>
  )
}
