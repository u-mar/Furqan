'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/cn'
import type { VoiceDiffRegion } from '@/lib/voice-similarity'

export type WaveformPlaybackTrack = 'ref' | 'user' | null

interface WaveformCompareProps {
  alignedRef: number[]
  alignedUser?: number[]
  matchHeatmap?: number[]
  refPitch?: (number | null)[]
  userPitch?: (number | null)[]
  diffRegions?: VoiceDiffRegion[]
  durationMs: number
  frameMs?: number
  playheadProgress?: number
  activeTrack?: WaveformPlaybackTrack
  className?: string
}

const LAYER_COLORS: Record<VoiceDiffRegion['layer'], string> = {
  tone: 'rgba(234, 179, 8, 0.28)',
  sound: 'rgba(168, 85, 247, 0.28)',
  flow: 'rgba(59, 130, 246, 0.28)',
}

function smoothPath(values: number[], height: number, padding: number, mirror = true): string {
  if (values.length === 0) return ''
  const max = Math.max(...values, 0.001)
  const usable = height - padding * 2
  const mid = height / 2

  const points = values.map((v, i) => {
    const x = (i / Math.max(values.length - 1, 1)) * 100
    const amp = (v / max) * (usable / 2)
    const y = mirror ? mid - amp : mid + amp
    return { x, y }
  })

  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]
    const curr = points[i]
    const cx = (prev.x + curr.x) / 2
    d += ` Q ${cx} ${prev.y} ${curr.x} ${curr.y}`
  }
  return d
}

function filledWavePath(values: number[], height: number): string {
  const top = smoothPath(values, height, 4, true)
  if (!top) return ''
  return `${top} L 100 ${height} L 0 ${height} Z`
}

function pitchPath(pitches: (number | null)[], height: number): { path: string } | null {
  const voiced = pitches.filter((p): p is number => p !== null)
  if (voiced.length < 3) return null

  const min = Math.min(...voiced)
  const max = Math.max(...voiced)
  const range = Math.max(max - min, 30)
  const padding = 6
  const usable = height - padding * 2

  const segments: string[] = []
  let segment = ''

  pitches.forEach((pitch, i) => {
    if (pitch === null) {
      if (segment) {
        segments.push(segment)
        segment = ''
      }
      return
    }
    const x = (i / Math.max(pitches.length - 1, 1)) * 100
    const y = padding + usable - ((pitch - min) / range) * usable
    segment += segment ? ` L ${x} ${y}` : `M ${x} ${y}`
  })
  if (segment) segments.push(segment)

  return { path: segments.join(' ') }
}

function formatTime(ms: number): string {
  const s = ms / 1000
  return s < 10 ? `${s.toFixed(1)}s` : `${Math.round(s)}s`
}

function Playhead({
  progress,
  height,
  id,
}: {
  progress: number
  height: number
  id: string
}) {
  const x = Math.min(100, Math.max(0, progress * 100))
  return (
    <g>
      <rect x={0} y={0} width={x} height={height} fill={`url(#playedDim-${id})`} opacity={0.12} />
      <line
        x1={x}
        y1={0}
        x2={x}
        y2={height}
        stroke="var(--home-heading)"
        strokeWidth={0.8}
        strokeOpacity={0.85}
      />
      <circle cx={x} cy={height / 2} r={1.8} fill="var(--home-heading)" />
    </g>
  )
}

function DiffLegend() {
  return (
    <div className="flex flex-wrap gap-3 text-[10px] text-[var(--app-muted)]">
      <span className="flex items-center gap-1">
        <span className="h-2 w-2 rounded-full bg-yellow-500/70" /> Tone
      </span>
      <span className="flex items-center gap-1">
        <span className="h-2 w-2 rounded-full bg-purple-500/70" /> Sound
      </span>
      <span className="flex items-center gap-1">
        <span className="h-2 w-2 rounded-full bg-blue-500/70" /> Flow
      </span>
    </div>
  )
}

export default function WaveformCompare({
  alignedRef,
  alignedUser = [],
  matchHeatmap = [],
  refPitch = [],
  userPitch = [],
  diffRegions,
  durationMs,
  frameMs = 48,
  playheadProgress = 0,
  activeTrack = null,
  className,
}: WaveformCompareProps) {
  const regions = useMemo(() => diffRegions ?? [], [diffRegions])
  const hasCompare = alignedUser.length > 0
  const isPlaying = activeTrack !== null && playheadProgress >= 0

  const refFill = useMemo(() => filledWavePath(alignedRef, 56), [alignedRef])
  const userFill = useMemo(() => filledWavePath(alignedUser, 56), [alignedUser])
  const refLine = useMemo(() => smoothPath(alignedRef, 56, 4, true), [alignedRef])
  const userLine = useMemo(() => smoothPath(alignedUser, 56, 4, true), [alignedUser])
  const refPitchLine = useMemo(() => pitchPath(refPitch, 40), [refPitch])
  const userPitchLine = useMemo(() => pitchPath(userPitch, 40), [userPitch])

  const heatRects = useMemo(() => {
    return matchHeatmap.map((diff, i) => {
      const x = (i / Math.max(matchHeatmap.length, 1)) * 100
      const w = 100 / Math.max(matchHeatmap.length, 1)
      const match = 1 - diff
      const r = Math.round(220 - match * 160)
      const g = Math.round(80 + match * 140)
      const b = Math.round(90 + match * 40)
      return { x, w, fill: `rgb(${r},${g},${b})` }
    })
  }, [matchHeatmap])

  const totalFrames = Math.max(alignedRef.length, 1)
  const playheadX = Math.min(100, Math.max(0, playheadProgress * 100))

  return (
    <div
      className={cn(
        'rounded-2xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] p-4 shadow-[var(--home-card-shadow)]',
        className
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--app-muted)]">
            {hasCompare ? 'Waveform analysis' : 'Reciter waveform'}
          </p>
          <p className="mt-0.5 text-[11px] text-[var(--app-muted)]">
            {hasCompare ? `Time-aligned · ${formatTime(durationMs)}` : formatTime(durationMs)}
            {isPlaying && (
              <span className="ml-1.5 font-medium text-[var(--home-sage-deep)]">
                · Playing {activeTrack === 'user' ? 'you' : 'reciter'}
              </span>
            )}
          </p>
        </div>
        {hasCompare && <DiffLegend />}
      </div>

      {hasCompare && matchHeatmap.length > 0 && (
        <div className="relative mb-2">
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-[var(--app-muted)]">
            Match map
          </p>
          <svg viewBox="0 0 100 8" className="h-2 w-full rounded-full overflow-hidden" preserveAspectRatio="none">
            {heatRects.map((rect, i) => (
              <rect key={i} x={rect.x} y={0} width={rect.w + 0.5} height={8} fill={rect.fill} />
            ))}
            {isPlaying && (
              <line
                x1={playheadX}
                y1={0}
                x2={playheadX}
                y2={8}
                stroke="var(--home-heading)"
                strokeWidth={0.9}
              />
            )}
          </svg>
          <div className="mt-0.5 flex justify-between text-[9px] text-[var(--app-muted)]">
            <span>Less similar</span>
            <span>More similar</span>
          </div>
        </div>
      )}

      <div
        className={cn(
          'relative mb-3 rounded-xl border bg-[var(--app-surface)]/40 p-2 transition-colors',
          activeTrack === 'ref' && 'border-[var(--home-sage)]/50 ring-1 ring-[var(--home-sage)]/25',
          activeTrack === 'user' && 'border-sky-500/50 ring-1 ring-sky-500/25',
          !activeTrack && 'border-[var(--home-card-border)]'
        )}
      >
        <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-[var(--app-muted)]">
          {hasCompare ? 'Aligned waveforms' : 'Reciter audio'}
        </p>
        <svg viewBox="0 0 100 56" className="h-20 w-full" preserveAspectRatio="none" aria-hidden>
          <defs>
            <linearGradient id="refWaveGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--home-sage)" stopOpacity="0.55" />
              <stop offset="100%" stopColor="var(--home-sage)" stopOpacity="0.05" />
            </linearGradient>
            <linearGradient id="userWaveGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.04" />
            </linearGradient>
            <linearGradient id="playedDim-wave" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--home-sage)" />
              <stop offset="100%" stopColor="var(--home-sage)" />
            </linearGradient>
          </defs>
          <line x1="0" y1="28" x2="100" y2="28" stroke="currentColor" strokeOpacity="0.08" />
          {hasCompare &&
            regions.map((r, i) => {
              const x1 = (r.startMs / frameMs / totalFrames) * 100
              const x2 = (r.endMs / frameMs / totalFrames) * 100
              return (
                <rect
                  key={i}
                  x={x1}
                  y={0}
                  width={Math.max(x2 - x1, 0.8)}
                  height={56}
                  fill={LAYER_COLORS[r.layer]}
                />
              )
            })}
          <path
            d={refFill}
            fill="url(#refWaveGrad)"
            opacity={activeTrack === 'user' && isPlaying ? 0.45 : 1}
          />
          {hasCompare && (
            <path
              d={userFill}
              fill="url(#userWaveGrad)"
              opacity={activeTrack === 'ref' && isPlaying ? 0.45 : 1}
            />
          )}
          <path
            d={refLine}
            fill="none"
            stroke="var(--home-sage-deep)"
            strokeWidth={activeTrack === 'ref' && isPlaying ? 1 : 0.6}
            opacity={activeTrack === 'user' && isPlaying ? 0.4 : 0.9}
          />
          {hasCompare && (
            <path
              d={userLine}
              fill="none"
              stroke="#0ea5e9"
              strokeWidth={activeTrack === 'user' && isPlaying ? 1 : 0.6}
              opacity={activeTrack === 'ref' && isPlaying ? 0.4 : 0.85}
            />
          )}
          {isPlaying && <Playhead progress={playheadProgress} height={56} id="wave" />}
        </svg>
        <div className="mt-1 flex justify-between text-[10px] text-[var(--app-muted)]">
          <span
            className={cn(
              'flex items-center gap-1',
              activeTrack === 'ref' && 'font-semibold text-[var(--home-sage-deep)]'
            )}
          >
            <span className="h-1.5 w-3 rounded-sm bg-[var(--home-sage-deep)]" /> Reciter
          </span>
          {hasCompare && (
            <span
              className={cn(
                'flex items-center gap-1',
                activeTrack === 'user' && 'font-semibold text-sky-600'
              )}
            >
              <span className="h-1.5 w-3 rounded-sm bg-sky-500" /> You
            </span>
          )}
        </div>
      </div>

      {hasCompare && (refPitchLine || userPitchLine) && (
        <div
          className={cn(
            'relative mb-3 rounded-xl border bg-[var(--app-surface)]/40 p-2',
            activeTrack ? 'border-[var(--home-card-border)]' : 'border-[var(--home-card-border)]'
          )}
        >
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-[var(--app-muted)]">
            Pitch contour (melody)
          </p>
          <svg viewBox="0 0 100 40" className="h-12 w-full" preserveAspectRatio="none" aria-hidden>
            {refPitchLine && (
              <path
                d={refPitchLine.path}
                fill="none"
                stroke="var(--home-sage-deep)"
                strokeWidth={activeTrack === 'ref' && isPlaying ? 1 : 0.7}
                strokeLinecap="round"
                opacity={activeTrack === 'user' && isPlaying ? 0.35 : 0.85}
              />
            )}
            {userPitchLine && (
              <path
                d={userPitchLine.path}
                fill="none"
                stroke="#0ea5e9"
                strokeWidth={activeTrack === 'user' && isPlaying ? 1 : 0.7}
                strokeLinecap="round"
                strokeDasharray="2 1.5"
                opacity={activeTrack === 'ref' && isPlaying ? 0.35 : 0.9}
              />
            )}
            {isPlaying && <Playhead progress={playheadProgress} height={40} id="pitch" />}
          </svg>
        </div>
      )}

      {hasCompare && regions.length > 0 && (
        <ul className="space-y-2 border-t border-[var(--home-card-border)] pt-3">
          {regions.slice(0, 3).map((r, i) => (
            <li key={i} className="flex gap-2 text-xs leading-relaxed text-[var(--app-text)]">
              <span
                className={cn(
                  'mt-1 h-2 w-2 shrink-0 rounded-full',
                  r.layer === 'tone' && 'bg-yellow-500',
                  r.layer === 'sound' && 'bg-purple-500',
                  r.layer === 'flow' && 'bg-blue-500'
                )}
              />
              <span>
                <span className="font-medium capitalize text-[var(--home-heading)]">{r.layer}</span>
                {' · '}
                {r.tip}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
