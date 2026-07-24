'use client'

import { useEffect, useState } from 'react'

interface VoiceScoreRingProps {
  value: number
  size?: number
  /** Small caption under the number, e.g. "Voice match". */
  caption?: string
}

function grade(value: number): { label: string; from: string; to: string } {
  if (value >= 90) return { label: 'Masterful', from: '#f4d59b', to: '#e0a94f' }
  if (value >= 80) return { label: 'Excellent', from: '#8fe3c4', to: '#39b98d' }
  if (value >= 68) return { label: 'Great', from: '#8163ef', to: '#6a4bd0' }
  if (value >= 55) return { label: 'Good', from: '#63c7d4', to: '#2f9e8f' }
  if (value >= 40) return { label: 'Fair', from: '#f0c877', to: '#d29a3c' }
  return { label: 'Keep going', from: '#f27ba4', to: '#c9527e' }
}

/** Animated circular gauge — the hero of the results screen. */
export default function VoiceScoreRing({ value, size = 168, caption = 'Voice match' }: VoiceScoreRingProps) {
  const [display, setDisplay] = useState(0)
  const g = grade(value)
  const stroke = 12
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const dash = c * (display / 100)

  useEffect(() => {
    let raf = 0
    const start = performance.now()
    const duration = 1100
    const from = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(Math.round(from + (value - from) * eased))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value])

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <div
        className="pointer-events-none absolute inset-0 rounded-full blur-2xl"
        style={{ background: `radial-gradient(circle, ${g.to}55, transparent 68%)` }}
        aria-hidden
      />
      <svg width={size} height={size} className="relative -rotate-90">
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={g.from} />
            <stop offset="100%" stopColor={g.to} />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--home-track)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#ringGrad)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          style={{ filter: `drop-shadow(0 0 6px ${g.to}88)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="home-serif text-[2.9rem] font-semibold leading-none text-[var(--home-heading)]">
          {display}
          <span className="text-xl align-top text-[var(--home-muted)]">%</span>
        </span>
        <span
          className="mt-1 rounded-full px-2.5 py-0.5 text-xs font-bold text-white"
          style={{ background: `linear-gradient(135deg, ${g.from}, ${g.to})` }}
        >
          {g.label}
        </span>
        <span className="mt-1 text-[11px] uppercase tracking-wider text-[var(--home-muted)]">
          {caption}
        </span>
      </div>
    </div>
  )
}
