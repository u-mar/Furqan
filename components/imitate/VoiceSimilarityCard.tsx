'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { VoiceAnalysisDetail } from '@/lib/voice-similarity'

interface VoiceSimilarityCardProps {
  voiceSimilarity: number
  tone: number
  sound: number
  flow: number
  detail?: VoiceAnalysisDetail
  className?: string
  defaultOpen?: boolean
}

function scoreLabel(value: number): string {
  if (value >= 85) return 'Excellent'
  if (value >= 70) return 'Good'
  if (value >= 50) return 'Fair'
  return 'Needs work'
}

function scoreColor(value: number): string {
  if (value >= 85) return 'var(--home-sage-deep)'
  if (value >= 70) return 'var(--home-sage)'
  if (value >= 50) return '#ca8a04'
  return '#dc2626'
}

function ScoreBar({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-[var(--app-muted)]">{label}</span>
        <span className="font-medium text-[var(--home-heading)]">{value}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--app-surface)]">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${value}%`, backgroundColor: scoreColor(value) }}
        />
      </div>
      {sub && <p className="mt-0.5 text-[10px] text-[var(--app-muted)]">{sub}</p>}
    </div>
  )
}

function DetailGrid({ detail }: { detail: VoiceAnalysisDetail }) {
  const items = [
    { label: 'Melody curve', value: detail.pitchContour },
    { label: 'Pitch range', value: detail.pitchRange },
    { label: 'Voice color', value: detail.voiceColor },
    { label: 'Spectral match', value: detail.spectralMatch },
    { label: 'Brightness', value: detail.brightness },
    { label: 'Rhythm', value: detail.rhythm },
    { label: 'Pauses', value: detail.pauses },
    { label: 'Word starts', value: detail.onsets },
  ]

  return (
    <div className="mt-4 grid grid-cols-2 gap-2 border-t border-[var(--home-card-border)] pt-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-lg bg-[var(--app-surface)]/60 px-2.5 py-2">
          <p className="text-[10px] text-[var(--app-muted)]">{item.label}</p>
          <p className="text-sm font-semibold" style={{ color: scoreColor(item.value) }}>
            {item.value}%
          </p>
        </div>
      ))}
    </div>
  )
}

export default function VoiceSimilarityCard({
  voiceSimilarity,
  tone,
  sound,
  flow,
  detail,
  className,
  defaultOpen = false,
}: VoiceSimilarityCardProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div
      className={cn(
        'rounded-2xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] shadow-[var(--home-card-shadow)]',
        className
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 p-4 text-left"
        aria-expanded={open}
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--home-sage)]">
            Voice similarity
          </p>
          <div className="mt-1 flex items-end gap-2">
            <p className="home-serif text-3xl font-semibold text-[var(--home-heading)]">
              {voiceSimilarity}%
            </p>
            <p className="mb-0.5 text-sm font-medium" style={{ color: scoreColor(voiceSimilarity) }}>
              {scoreLabel(voiceSimilarity)}
            </p>
          </div>
          {!open && (
            <p className="mt-1 text-xs text-[var(--app-muted)]">
              Tone {tone}% · Sound {sound}% · Flow {flow}%
            </p>
          )}
        </div>
        <ChevronDown
          className={cn(
            'h-5 w-5 shrink-0 text-[var(--app-muted)] transition-transform duration-200',
            open && 'rotate-180'
          )}
        />
      </button>

      {open && (
        <div className="border-t border-[var(--home-card-border)] px-4 pb-4 pt-3">
          <div className="space-y-3">
            <ScoreBar
              label="Tone · intonation & melody"
              value={tone}
              sub="How closely your pitch rises and falls"
            />
            <ScoreBar
              label="Sound · voice color"
              value={sound}
              sub="Timbre, brightness, and vocal quality"
            />
            <ScoreBar
              label="Flow · rhythm & pauses"
              value={flow}
              sub="Timing, breath points, and pace"
            />
          </div>
          {detail && <DetailGrid detail={detail} />}
        </div>
      )}
    </div>
  )
}
