'use client'

import { useEffect, useRef } from 'react'
import { Check, Download } from 'lucide-react'
import { cn } from '@/lib/cn'
import { tapFeedback } from '@/lib/haptics'
import { queueDownload, type DownloadState } from '@/lib/listen-downloads'
import { useSurahDownload } from '@/hooks/useListen'
import type { Chapter } from '@/types'

const R = 11
const CIRCUMFERENCE = 2 * Math.PI * R

/** A ring that fills as a surah is saved; it turns while waiting for its turn. */
export function DownloadRing({ percent, waiting }: { percent: number; waiting: boolean }) {
  return (
    <span className="relative flex h-9 w-9 shrink-0 items-center justify-center">
      <svg viewBox="0 0 28 28" className={cn('h-[30px] w-[30px]', waiting && 'listen-ring--waiting')} aria-hidden>
        <circle cx="14" cy="14" r={R} fill="none" stroke="var(--home-track)" strokeWidth="2.4" />
        <circle
          className="listen-ring__fill"
          cx="14"
          cy="14"
          r={R}
          fill="none"
          stroke="var(--home-sage)"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeDasharray={`${(waiting ? 0.22 : percent / 100) * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
          transform="rotate(-90 14 14)"
        />
      </svg>
      {waiting ? null : (
        <span className="absolute text-[8.5px] font-bold tabular-nums text-[var(--home-sage-deep)]">{percent}</span>
      )}
    </span>
  )
}

/** The download control at the end of a surah row. */
export default function DownloadButton({
  reciterId,
  chapter,
  disabled = false,
}: {
  reciterId: string
  chapter: Chapter
  disabled?: boolean
}) {
  const download = useSurahDownload(reciterId, chapter.id)
  const previous = useRef<DownloadState>(download.state)
  const justSaved = download.state === 'done' && previous.current !== 'done' && previous.current !== 'none'

  useEffect(() => {
    previous.current = download.state
  })

  if (download.state === 'done') {
    return (
      <span className="flex h-11 w-11 shrink-0 items-center justify-center" role="img" aria-label="Downloaded">
        <span
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-full bg-[var(--home-sage-soft)] text-[var(--home-sage-deep)]',
            justSaved && 'fx-pop-in fx-ring'
          )}
        >
          <Check className={cn('h-4 w-4', justSaved && 'fx-draw')} strokeWidth={2.6} />
        </span>
      </span>
    )
  }

  if (download.state === 'queued' || download.state === 'saving') {
    return (
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center"
        role="progressbar"
        aria-label={`Downloading ${chapter.englishName}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={download.percent}
      >
        <DownloadRing percent={download.percent} waiting={download.state === 'queued' || download.percent === 0} />
      </span>
    )
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        tapFeedback()
        queueDownload(reciterId, chapter)
      }}
      aria-label={`Download ${chapter.englishName}`}
      className="ed-focus fx-press flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--home-muted)] transition-colors hover:text-[var(--home-heading)] disabled:opacity-40"
    >
      <Download className="h-[18px] w-[18px]" strokeWidth={1.9} />
    </button>
  )
}
