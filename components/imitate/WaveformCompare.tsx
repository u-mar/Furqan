'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/cn'
import type { VoiceDiffRegion } from '@/lib/voice-similarity'

interface WaveformCompareProps {
  refWaveform: number[]
  userWaveform: number[]
  diffRegions?: VoiceDiffRegion[]
  className?: string
}

function WaveformRow({
  data,
  label,
  diffRegions,
  frameMs,
}: {
  data: number[]
  label: string
  diffRegions?: VoiceDiffRegion[]
  frameMs: number
}) {
  const max = Math.max(...data, 0.001)
  const points = data
    .map((v, i) => {
      const x = (i / Math.max(data.length - 1, 1)) * 100
      const y = 100 - (v / max) * 80 - 10
      return `${x},${y}`
    })
    .join(' ')

  return (
    <div className="space-y-1">
      <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--app-muted)]">{label}</p>
      <svg viewBox="0 0 100 100" className="h-14 w-full" preserveAspectRatio="none" aria-hidden>
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-[var(--home-sage)]"
          points={points}
        />
        {diffRegions?.map((r, i) => {
          const x1 = (r.startMs / frameMs / Math.max(data.length, 1)) * 100
          const x2 = (r.endMs / frameMs / Math.max(data.length, 1)) * 100
          return (
            <rect
              key={i}
              x={x1}
              y={0}
              width={Math.max(x2 - x1, 1)}
              height={100}
              fill="currentColor"
              className="text-red-400/25"
            />
          )
        })}
      </svg>
    </div>
  )
}

const FRAME_MS = 50

export default function WaveformCompare({
  refWaveform,
  userWaveform,
  diffRegions,
  className,
}: WaveformCompareProps) {
  const regions = useMemo(() => diffRegions ?? [], [diffRegions])

  return (
    <div
      className={cn(
        'rounded-2xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] p-4',
        className
      )}
    >
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--app-muted)]">
        Voice comparison
      </p>
      <WaveformRow data={refWaveform} label="Reciter" frameMs={FRAME_MS} />
      <WaveformRow data={userWaveform} label="You" diffRegions={regions} frameMs={FRAME_MS} />
      {regions.length > 0 && (
        <ul className="mt-3 space-y-1">
          {regions.slice(0, 2).map((r, i) => (
            <li key={i} className="text-xs text-[var(--app-muted)]">
              • {r.tip}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
