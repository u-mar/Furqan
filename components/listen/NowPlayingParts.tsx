'use client'

import { useEffect, useRef, useState } from 'react'
import { Moon } from 'lucide-react'
import { SleepLeft } from '@/components/listen/SleepControls'
import { useListenProgress, useListenState } from '@/hooks/useListen'
import { tapFeedback } from '@/lib/haptics'
import { formatClock, seekTo } from '@/lib/listen-player'
import { cn } from '@/lib/cn'
import { useT } from '@/lib/i18n'

/**
 * Pieces of Now playing that Video mode shows too: the place in the surah and the sleep button.
 */

/** While the slider is dragged, the audio follows it this often (a stream must not be asked to jump on every pixel). */
const LIVE_SEEK_MS = 150
/** Still this long after the last move, the slider goes back to showing the audio, even if no release was reported. */
const SETTLE_MS = 800

export function SeekBar({ className = 'mt-5 px-1' }: { className?: string }) {
  const t = useT()
  const { position, duration } = useListenProgress()
  const [scrub, setScrub] = useState<number | null>(null)
  const value = Math.min(scrub ?? position, duration || 0)
  const played = duration ? (value / duration) * 100 : 0
  const lastSeekAt = useRef(0)
  const pendingSeek = useRef<number | null>(null)
  const settleTimer = useRef<number | null>(null)

  // Moving the slider moves the recitation there, as the finger goes: a few times
  // a second while it moves, and once more at the very place it stops.
  const follow = (seconds: number) => {
    setScrub(seconds)
    if (pendingSeek.current !== null) window.clearTimeout(pendingSeek.current)
    const wait = LIVE_SEEK_MS - (performance.now() - lastSeekAt.current)
    const go = () => {
      pendingSeek.current = null
      lastSeekAt.current = performance.now()
      seekTo(seconds)
    }
    if (wait <= 0) go()
    else pendingSeek.current = window.setTimeout(go, wait)
    // Some phones never report the finger lifting off a slider: once it has been
    // still a moment, the place it was left is taken as final.
    if (settleTimer.current !== null) window.clearTimeout(settleTimer.current)
    settleTimer.current = window.setTimeout(() => {
      settleTimer.current = null
      if (pendingSeek.current !== null) {
        window.clearTimeout(pendingSeek.current)
        pendingSeek.current = null
        seekTo(seconds)
      }
      setScrub(null)
    }, SETTLE_MS)
  }

  // Let go, however the phone reports it (a lift, a cancel, a touch ending, a key, leaving the slider).
  const commit = () => {
    if (scrub === null) return
    if (pendingSeek.current !== null) window.clearTimeout(pendingSeek.current)
    if (settleTimer.current !== null) window.clearTimeout(settleTimer.current)
    pendingSeek.current = null
    settleTimer.current = null
    seekTo(scrub)
    setScrub(null)
  }

  useEffect(
    () => () => {
      if (pendingSeek.current !== null) window.clearTimeout(pendingSeek.current)
      if (settleTimer.current !== null) window.clearTimeout(settleTimer.current)
    },
    []
  )

  return (
    <div className={className}>
      <input
        type="range"
        min={0}
        max={duration || 1}
        step={1}
        value={value}
        disabled={!duration}
        onChange={(e) => follow(Number(e.target.value))}
        onPointerUp={commit}
        onPointerCancel={commit}
        onTouchEnd={commit}
        onMouseUp={commit}
        onKeyUp={commit}
        onBlur={commit}
        aria-label={t('Position in the surah')}
        aria-valuetext={`${formatClock(value)} of ${formatClock(duration)}`}
        className="listen-seek"
        style={{ ['--fill' as string]: `${played}%` }}
      />
      <div className="mt-0.5 flex justify-between text-[0.78125rem] font-medium tabular-nums text-[var(--home-muted)]">
        <span>{formatClock(value)}</span>
        <span>{duration ? formatClock(duration) : '--:--'}</span>
      </div>
    </div>
  )
}

/** The moon at the top right: plain while off, the time left once on. */
export function SleepTopButton({ onOpen, className }: { onOpen: () => void; className?: string }) {
  const t = useT()
  const { sleep } = useListenState()
  const open = () => {
    tapFeedback()
    onOpen()
  }

  if (!sleep) {
    return (
      <button type="button" onClick={open} className={cn('home-round ed-focus', className)} aria-label={t('Sleep mode')}>
        <Moon className="h-[19px] w-[19px]" strokeWidth={1.9} />
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={open}
      aria-label={t('Sleep mode is on')}
      className={cn(
        'fx-pop-in fx-press ed-focus flex h-[42px] shrink-0 items-center gap-[7px] rounded-full bg-[var(--home-card-bg)] pl-3 pr-3.5 text-[0.84375rem] font-semibold tabular-nums text-[var(--home-sage-deep)] shadow-[var(--home-lift-sm)]',
        className
      )}
    >
      <Moon className="h-4 w-4 fill-current text-[var(--home-sage)]" strokeWidth={1.9} />
      <SleepLeft fallback={t('On')} />
    </button>
  )
}
