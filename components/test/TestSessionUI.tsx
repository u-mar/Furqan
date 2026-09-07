'use client'

import { Check, Meh, Play, RotateCcw, Square, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { Grade } from '@/lib/hifdh-progress'

/* ---------------- Progress ---------------- */

export function SessionProgress({
  index,
  total,
  results,
}: {
  index: number
  total: number
  results: Grade[]
}) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <div className="flex flex-1 gap-1">
        {Array.from({ length: total }).map((_, i) => {
          const grade = results[i]
          return (
            <span
              key={i}
              className={cn(
                'h-1.5 flex-1 rounded-full transition-colors',
                grade === 'got' && 'bg-[var(--home-sage-deep)]',
                grade === 'shaky' && 'bg-amber-500',
                grade === 'missed' && 'bg-rose-500',
                !grade && (i === index ? 'bg-[var(--home-rule-strong)]' : 'bg-[var(--home-track)]')
              )}
            />
          )
        })}
      </div>
      <span className="ed-num shrink-0 text-[11px] font-semibold text-[var(--home-muted)]">
        {Math.min(index + 1, total)}/{total}
      </span>
    </div>
  )
}

/* ---------------- Hints ---------------- */

export const HINT_LABELS = ['Show first word', 'Show first line', 'Reveal the ayah'] as const

export function HintCard({
  level,
  words,
  onHint,
  onReveal,
  revealed,
  audioUrl,
  playing,
  onToggleAudio,
}: {
  level: number
  words: string[]
  onHint: () => void
  onReveal: () => void
  revealed: boolean
  audioUrl: string | null
  playing: boolean
  onToggleAudio: () => void
}) {
  // Level 1 uncovers the opening word, level 2 about a line's worth.
  const shown = level <= 0 ? [] : level === 1 ? words.slice(0, 1) : words.slice(0, Math.min(6, words.length))

  return (
    <div className="shrink-0 rounded-2xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] p-3">
      {shown.length > 0 ? (
        <p
          className="amiri mb-2.5 text-center text-[1.35rem] leading-[2] text-[var(--home-heading)]"
          dir="rtl"
          lang="ar"
        >
          {shown.join(' ')}
          {!revealed && level < 3 ? (
            <span className="text-[var(--home-muted)]"> …</span>
          ) : null}
        </p>
      ) : (
        <p className="mb-2.5 text-center text-xs text-[var(--home-muted)]">
          Recite the next ayah from memory, then check yourself.
        </p>
      )}

      <div className="flex items-center gap-2">
        {!revealed ? (
          <button
            type="button"
            onClick={level >= 2 ? onReveal : onHint}
            className="ed-focus flex h-11 flex-1 items-center justify-center gap-2 rounded-full border border-[var(--home-rule-strong)] text-[0.82rem] font-semibold text-[var(--home-heading)] transition-colors hover:bg-[var(--home-track)] active:scale-[0.98]"
          >
            {HINT_LABELS[Math.min(level, 2)]}
          </button>
        ) : (
          <button
            type="button"
            onClick={onToggleAudio}
            disabled={!audioUrl}
            className="ed-focus flex h-11 flex-1 items-center justify-center gap-2 rounded-full border border-[var(--home-rule-strong)] text-[0.82rem] font-semibold text-[var(--home-heading)] transition-colors hover:bg-[var(--home-track)] active:scale-[0.98] disabled:opacity-40"
          >
            {playing ? (
              <Square className="h-3.5 w-3.5 fill-current" />
            ) : (
              <Play className="h-3.5 w-3.5 fill-current" />
            )}
            {playing ? 'Stop' : 'Hear it'}
          </button>
        )}
      </div>
    </div>
  )
}

/* ---------------- Grading ---------------- */

const GRADE_BUTTONS: { grade: Grade; label: string; Icon: typeof Check; classes: string }[] = [
  {
    grade: 'missed',
    label: 'Missed',
    Icon: X,
    classes: 'border-rose-500/40 text-rose-600 hover:bg-rose-500/10 dark:text-rose-300',
  },
  {
    grade: 'shaky',
    label: 'Shaky',
    Icon: Meh,
    classes: 'border-amber-500/40 text-amber-600 hover:bg-amber-500/10 dark:text-amber-300',
  },
  {
    grade: 'got',
    label: 'Got it',
    Icon: Check,
    classes:
      'border-[var(--home-sage)] text-[var(--home-sage-deep)] hover:bg-[var(--home-sage-soft)]',
  },
]

export function GradeBar({ onGrade }: { onGrade: (grade: Grade) => void }) {
  return (
    <div>
      <p className="mb-2 text-center text-[11px] font-semibold uppercase tracking-wider text-[var(--home-muted)]">
        How did that go?
      </p>
      <div className="grid grid-cols-3 gap-2">
        {GRADE_BUTTONS.map(({ grade, label, Icon, classes }) => (
          <button
            key={grade}
            type="button"
            onClick={() => onGrade(grade)}
            className={cn(
              'ed-focus flex h-[3.25rem] flex-col items-center justify-center gap-0.5 rounded-2xl border bg-[var(--home-card-bg)] text-[0.72rem] font-semibold transition-transform active:scale-[0.97]',
              classes
            )}
          >
            <Icon className="h-[18px] w-[18px]" strokeWidth={2.2} />
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

/* ---------------- Summary ---------------- */

export interface SessionResult {
  verseKey: string
  surahName: string
  grade: Grade
}

export function SessionSummary({
  results,
  elapsedMs,
  dayStreak,
  onAgain,
  onDrillWeak,
}: {
  results: SessionResult[]
  elapsedMs: number
  dayStreak: number
  onAgain: () => void
  onDrillWeak: () => void
}) {
  const got = results.filter((r) => r.grade === 'got').length
  const total = results.length
  const pct = total > 0 ? Math.round((got / total) * 100) : 0
  const needsWork = results.filter((r) => r.grade !== 'got')
  const minutes = Math.floor(elapsedMs / 60000)
  const seconds = Math.round((elapsedMs % 60000) / 1000)

  const circumference = 2 * Math.PI * 52

  return (
    <div className="mx-auto w-full max-w-md pb-8">
      <div className="ed-card rounded-[1.5rem] p-6 text-center">
        <p className="ed-label">Session complete</p>

        <div className="relative mx-auto mt-4 h-32 w-32">
          <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
            <circle
              cx="60"
              cy="60"
              r="52"
              fill="none"
              stroke="var(--home-track)"
              strokeWidth="9"
            />
            <circle
              cx="60"
              cy="60"
              r="52"
              fill="none"
              stroke="var(--home-sage-deep)"
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - pct / 100)}
              className="transition-[stroke-dashoffset] duration-700 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="ed-num text-[2rem] font-semibold leading-none text-[var(--home-heading)]">
              {pct}%
            </span>
            <span className="mt-1 text-[11px] text-[var(--home-muted)]">
              {got} of {total}
            </span>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-center gap-6 text-xs text-[var(--home-muted)]">
          <span>
            <span className="ed-num block text-[1.1rem] font-semibold text-[var(--home-heading)]">
              {minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`}
            </span>
            time
          </span>
          <span className="h-8 w-px bg-[var(--home-rule)]" />
          <span>
            <span className="ed-num block text-[1.1rem] font-semibold text-[var(--home-heading)]">
              {dayStreak}
            </span>
            day streak
          </span>
        </div>
      </div>

      {needsWork.length > 0 ? (
        <div className="ed-card mt-3 rounded-[1.5rem] p-4">
          <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-[var(--home-muted)]">
            Worth another look
          </p>
          <ul className="space-y-1.5">
            {needsWork.map((r) => (
              <li
                key={r.verseKey}
                className="flex items-center justify-between gap-3 rounded-xl bg-[var(--home-track)] px-3 py-2"
              >
                <span className="min-w-0 truncate text-sm text-[var(--home-heading)]">
                  {r.surahName}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="ed-num text-xs text-[var(--home-muted)]">{r.verseKey}</span>
                  <span
                    className={cn(
                      'h-2 w-2 rounded-full',
                      r.grade === 'shaky' ? 'bg-amber-500' : 'bg-rose-500'
                    )}
                  />
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-3 text-center text-sm text-[var(--home-muted)]">
          Clean run — every ayah recalled.
        </p>
      )}

      <div className="mt-4 space-y-2">
        <button
          type="button"
          onClick={onAgain}
          className="ed-ink ed-focus flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold transition-transform active:scale-[0.98]"
        >
          <RotateCcw className="h-4 w-4" />
          Practise again
        </button>
        {needsWork.length > 0 ? (
          <button
            type="button"
            onClick={onDrillWeak}
            className="ed-focus flex h-12 w-full items-center justify-center rounded-full border border-[var(--home-rule-strong)] text-sm font-semibold text-[var(--home-heading)] transition-colors hover:bg-[var(--home-track)]"
          >
            Drill the {needsWork.length} I missed
          </button>
        ) : null}
      </div>
    </div>
  )
}
