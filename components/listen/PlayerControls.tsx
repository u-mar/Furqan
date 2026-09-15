'use client'

import { Loader2, Pause, Play, RotateCcw, RotateCw } from 'lucide-react'
import { cn } from '@/lib/cn'
import { tapFeedback } from '@/lib/haptics'
import { seekBy, togglePlay, type ListenStatus } from '@/lib/listen-player'

/** The ink play/pause button; its icon trades places instead of snapping. */
export function PlayPauseButton({
  status,
  size,
  className,
}: {
  status: ListenStatus
  size: number
  className?: string
}) {
  const loading = status === 'loading'
  const playing = status === 'playing' || loading
  const icon = Math.round(size * 0.36)
  return (
    <button
      type="button"
      onClick={() => {
        tapFeedback()
        togglePlay()
      }}
      aria-label={playing ? 'Pause' : 'Play'}
      className={cn('ed-ink ed-focus fx-press flex shrink-0 items-center justify-center rounded-full', className)}
      style={{ width: size, height: size }}
    >
      <span key={loading ? 'loading' : playing ? 'pause' : 'play'} className="qari-swap flex">
        {loading ? (
          <Loader2 className="animate-spin" style={{ width: icon, height: icon }} strokeWidth={2.4} />
        ) : playing ? (
          <Pause className="fill-current" style={{ width: icon, height: icon }} strokeWidth={0} />
        ) : (
          <Play
            className="fill-current"
            style={{ width: icon, height: icon, marginLeft: Math.round(icon * 0.14) }}
            strokeWidth={1.6}
          />
        )}
      </span>
    </button>
  )
}

/** Back or forward a few seconds: the circular arrow with the number inside it. */
export function SkipButton({ seconds, size, raised = false }: { seconds: number; size: number; raised?: boolean }) {
  const back = seconds < 0
  const Icon = back ? RotateCcw : RotateCw
  const icon = Math.round(size * (raised ? 0.5 : 0.58))
  return (
    <button
      type="button"
      onClick={() => {
        tapFeedback()
        seekBy(seconds)
      }}
      aria-label={back ? `Back ${-seconds} seconds` : `Forward ${seconds} seconds`}
      className={cn(
        'ed-focus fx-press relative flex shrink-0 items-center justify-center rounded-full text-[var(--home-heading)]',
        raised && 'bg-[var(--home-card-bg)] shadow-[var(--home-lift-sm)]'
      )}
      style={{ width: size, height: size }}
    >
      <Icon style={{ width: icon, height: icon }} strokeWidth={1.7} />
      <span
        className="absolute inset-0 flex items-center justify-center font-bold tabular-nums tracking-[-0.03em]"
        style={{ fontSize: Math.max(7.5, Math.round(icon * 0.3)), paddingTop: 1 }}
        aria-hidden
      >
        {Math.abs(seconds)}
      </span>
    </button>
  )
}

/** The small bars beside what is playing; they rest while it is paused. */
export function Equalizer({ paused = false }: { paused?: boolean }) {
  return (
    <span className={cn('listen-eq', paused && 'listen-eq--paused')} aria-hidden>
      <span />
      <span />
      <span />
      <span />
    </span>
  )
}
