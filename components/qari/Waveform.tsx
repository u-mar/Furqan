'use client'

import { useCallback, useMemo, useRef } from 'react'
import { cn } from '@/lib/cn'

/** Squeeze or stretch a peak list to exactly `count` bars. */
function resample(peaks: number[], count: number): number[] {
  if (peaks.length === count) return peaks
  const out: number[] = []
  for (let i = 0; i < count; i += 1) {
    const start = Math.floor((i / count) * peaks.length)
    const end = Math.max(start + 1, Math.floor(((i + 1) / count) * peaks.length))
    let max = 0
    for (let j = start; j < end && j < peaks.length; j += 1) max = Math.max(max, peaks[j])
    out.push(max)
  }
  return out
}

/**
 * A gentle, repeatable shape for recordings made before waveforms were saved,
 * so they still look like sound rather than a flat bar.
 */
function placeholderPeaks(seed: string, count: number): number[] {
  let h = 2166136261
  for (let i = 0; i < seed.length; i += 1) h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  const out: number[] = []
  let smooth = 50
  for (let i = 0; i < count; i += 1) {
    h = Math.imul(h ^ (h >>> 13), 1274126177)
    const r = ((h >>> 0) % 1000) / 1000
    smooth += (25 + r * 75 - smooth) * 0.55
    out.push(smooth)
  }
  return out
}

/**
 * The shape of a recitation, filled in as it plays. Drag or tap along it to
 * jump; arrow keys step five seconds' worth when it has focus.
 */
export default function Waveform({
  peaks,
  seed,
  progress,
  bars = 40,
  onSeek,
  className,
  label = 'Position',
}: {
  peaks: number[]
  seed: string
  /** 0–1 */
  progress: number
  bars?: number
  onSeek?: (fraction: number) => void
  className?: string
  label?: string
}) {
  const values = useMemo(
    () => resample(peaks.length > 0 ? peaks : placeholderPeaks(seed, bars), bars),
    [bars, peaks, seed]
  )
  const draggingRef = useRef(false)

  const seekFrom = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!onSeek) return
      const rect = event.currentTarget.getBoundingClientRect()
      onSeek(Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)))
    },
    [onSeek]
  )

  const playedBars = progress * bars

  return (
    <div
      role={onSeek ? 'slider' : undefined}
      aria-label={onSeek ? label : undefined}
      aria-valuemin={onSeek ? 0 : undefined}
      aria-valuemax={onSeek ? 100 : undefined}
      aria-valuenow={onSeek ? Math.round(progress * 100) : undefined}
      tabIndex={onSeek ? 0 : undefined}
      onKeyDown={(e) => {
        if (!onSeek) return
        if (e.key === 'ArrowRight') onSeek(Math.min(1, progress + 0.05))
        if (e.key === 'ArrowLeft') onSeek(Math.max(0, progress - 0.05))
      }}
      onPointerDown={(e) => {
        if (!onSeek) return
        draggingRef.current = true
        e.currentTarget.setPointerCapture(e.pointerId)
        seekFrom(e)
      }}
      onPointerMove={(e) => {
        if (draggingRef.current) seekFrom(e)
      }}
      onPointerUp={() => {
        draggingRef.current = false
      }}
      onPointerCancel={() => {
        draggingRef.current = false
      }}
      className={cn(
        'ed-focus flex touch-none items-center gap-[2px] overflow-hidden',
        onSeek && 'cursor-pointer',
        className
      )}
    >
      {values.map((value, i) => (
        <span
          key={i}
          className="min-w-px flex-1 rounded-full transition-colors duration-150"
          style={{
            height: `${Math.max(14, value)}%`,
            background: i < playedBars ? 'var(--home-sage)' : 'var(--home-rule-strong)',
          }}
        />
      ))}
    </div>
  )
}
