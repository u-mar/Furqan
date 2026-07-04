'use client'

import { cn } from '@/lib/cn'

interface VoiceSimilarityCardProps {
  voiceSimilarity: number
  tone: number
  sound: number
  flow: number
  className?: string
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-[var(--app-muted)]">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--app-surface)]">
        <div
          className="h-full rounded-full bg-[var(--home-sage)] transition-all duration-500"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  )
}

export default function VoiceSimilarityCard({
  voiceSimilarity,
  tone,
  sound,
  flow,
  className,
}: VoiceSimilarityCardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] p-4 shadow-[var(--home-card-shadow)]',
        className
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--home-sage)]">
        Voice similarity
      </p>
      <p className="home-serif mt-1 text-4xl font-semibold text-[var(--home-heading)]">
        {voiceSimilarity}%
      </p>
      <div className="mt-4 space-y-3">
        <ScoreBar label="Tone" value={tone} />
        <ScoreBar label="Sound" value={sound} />
        <ScoreBar label="Flow" value={flow} />
      </div>
    </div>
  )
}
