'use client'

import { Check, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { DayLine } from '@/lib/halaqa'

function tone(name: string): number {
  let sum = 0
  for (const char of name) sum = (sum + char.charCodeAt(0)) % 997
  return sum % 3
}

/** Someone's initial; a small tick sits on it once they have read today, popping in if `pop`. */
export function MemberAvatar({
  name,
  size = 36,
  read = false,
  me = false,
  faded = false,
  pop = false,
}: {
  name: string
  size?: number
  read?: boolean
  me?: boolean
  faded?: boolean
  pop?: boolean
}) {
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      <span
        className={cn('halaqa-avatar', me ? 'halaqa-avatar--me' : `halaqa-avatar--${tone(name)}`, faded && 'halaqa-avatar--faded')}
        style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
      >
        {(name.trim().charAt(0) || '?').toUpperCase()}
      </span>
      {read ? (
        <span className={cn('halaqa-tick', pop && 'fx-pop-in')} style={pop ? { animationDelay: '180ms' } : undefined} aria-hidden>
          <Check className="h-[9px] w-[9px]" strokeWidth={4} />
        </span>
      ) : null}
    </span>
  )
}

/** One small square per day, oldest first, in two rows. */
export function DayDots({ days, size }: { days: number[]; size?: number }) {
  const dot = size ?? (days.length > 30 ? 5 : 6)
  return (
    <span
      className="halaqa-dots"
      style={{ gridTemplateColumns: `repeat(${Math.ceil(days.length / 2)}, ${dot}px)` }}
      aria-hidden
    >
      {days.map((day, i) => (
        <span
          key={i}
          className={cn('halaqa-dot', day === 1 && 'halaqa-dot--read', day === -1 && 'halaqa-dot--before')}
          style={{ width: dot, height: dot }}
        />
      ))}
    </span>
  )
}

export function daysLabel(line: DayLine): string {
  return `Read on ${line.count} of ${line.possible} days`
}

/** A person with the days they read — Halaqa settings and the end screen. */
export function ReadingDaysRow({
  name,
  me = false,
  line,
  onOpen,
}: {
  name: string
  me?: boolean
  line: DayLine
  onOpen?: () => void
}) {
  const body = (
    <>
      <MemberAvatar name={name} me={me} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.9375rem] font-semibold text-[var(--home-heading)]">
          {name}
          {me ? <span className="font-medium text-[var(--home-muted)]"> (you)</span> : null}
        </span>
        <span className="mt-[5px] block">
          <DayDots days={line.days} />
        </span>
      </span>
      <span className="shrink-0 text-[0.84375rem] font-semibold tabular-nums text-[var(--home-heading)]">
        {line.possible ? (
          <>
            {line.count}
            <span className="font-medium text-[var(--home-muted)]">/{line.possible}</span>
          </>
        ) : (
          <span className="font-medium text-[var(--home-muted)]">—</span>
        )}
      </span>
      {onOpen ? <ChevronRight className="h-[17px] w-[17px] shrink-0 text-[var(--home-muted)]" strokeWidth={2} /> : null}
    </>
  )

  if (onOpen) {
    return (
      <button type="button" onClick={onOpen} className="set-row" style={ROW_STYLE} aria-label={`${name}: ${daysLabel(line)}`}>
        {body}
      </button>
    )
  }
  return (
    <div className="set-row" style={ROW_STYLE} aria-label={`${name}: ${daysLabel(line)}`}>
      {body}
    </div>
  )
}

/** .set-row sets its own height and padding, which a utility class would not override. */
const ROW_STYLE = { minHeight: 60, paddingBlock: 10 } as const

/** Me first, then everyone by name, so a list never reads as a ranking. */
export function byMeThenName<T extends { name: string; isMe: boolean }>(a: T, b: T): number {
  if (a.isMe !== b.isMe) return a.isMe ? -1 : 1
  return a.name.localeCompare(b.name)
}
