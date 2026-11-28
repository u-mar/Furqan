'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * The admin's building blocks, so every section reads the same: a card, a section header, a key
 * number, a status pill, buttons, an empty state and a table.
 */

export function Card({ title, description, actions, children, className, padded = true }: {
  title?: ReactNode
  description?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  padded?: boolean
}) {
  return (
    <section className={cn('rounded-2xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)]', className)}>
      {title || actions ? (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--home-card-border)] px-4 py-3">
          <div className="min-w-0">
            {title ? <h2 className="text-[0.875rem] font-semibold text-[var(--home-heading)]">{title}</h2> : null}
            {description ? <p className="mt-0.5 text-[0.75rem] leading-relaxed text-[var(--home-muted)]">{description}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      <div className={padded ? 'p-4' : undefined}>{children}</div>
    </section>
  )
}

export function Stat({ label, value, hint, trend, live }: {
  label: string
  value: ReactNode
  hint?: ReactNode
  /** Change against the period before, as a fraction (0.12 = +12%). */
  trend?: number | null
  live?: boolean
}) {
  return (
    <div className="rounded-2xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] px-4 py-3.5">
      <p className="flex items-center gap-1.5 text-[0.75rem] font-medium text-[var(--home-muted)]">
        {live ? <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" aria-hidden /> : null}
        {label}
      </p>
      <p className="mt-1 text-[1.625rem] font-semibold leading-tight tracking-[-0.02em] text-[var(--home-heading)] tabular-nums">{value}</p>
      {trend !== undefined && trend !== null && Number.isFinite(trend) ? (
        <p className={cn('mt-0.5 text-[0.71875rem] font-medium tabular-nums', trend >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
          {trend >= 0 ? '▲' : '▼'} {Math.abs(Math.round(trend * 100))}%
          <span className="font-normal text-[var(--home-muted)]"> {hint}</span>
        </p>
      ) : hint ? (
        <p className="mt-0.5 text-[0.71875rem] text-[var(--home-muted)]">{hint}</p>
      ) : null}
    </div>
  )
}

const TONES = {
  neutral: 'bg-[var(--app-surface)] text-[var(--home-muted)]',
  good: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300',
  warn: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  bad: 'bg-red-500/12 text-red-600 dark:text-red-400',
  accent: 'bg-[var(--home-sage-soft)] text-[var(--home-sage-deep)]',
}

export function Pill({ tone = 'neutral', children }: { tone?: keyof typeof TONES; children: ReactNode }) {
  return <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold', TONES[tone])}>{children}</span>
}

export const button = {
  primary:
    'inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--home-sage-deep)] px-3.5 py-2 text-[0.8125rem] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-45',
  secondary:
    'inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--home-card-border)] bg-[var(--home-card-bg)] px-3 py-1.5 text-[0.8125rem] font-medium text-[var(--home-heading)] transition-colors hover:bg-[var(--app-surface)] disabled:opacity-45',
  danger:
    'inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-1.5 text-[0.8125rem] font-medium text-red-600 transition-colors hover:bg-red-500/10 disabled:opacity-45 dark:text-red-400',
  ghost:
    'inline-flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[0.8125rem] font-medium text-[var(--home-muted)] transition-colors hover:bg-[var(--app-surface)] hover:text-[var(--home-heading)] disabled:opacity-45',
}

export const field =
  'w-full min-w-0 rounded-lg border border-[var(--home-card-border)] bg-[var(--app-surface)] px-3 py-2 text-[0.875rem] text-[var(--app-text)] placeholder:text-[var(--home-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--home-sage-deep)]/30'

export function Empty({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      {icon ? <div className="mb-2 text-[var(--home-muted)]">{icon}</div> : null}
      <p className="text-[0.875rem] font-semibold text-[var(--home-heading)]">{title}</p>
      {children ? <p className="mt-1 max-w-sm text-[0.8125rem] leading-relaxed text-[var(--home-muted)]">{children}</p> : null}
    </div>
  )
}

/** A table that scrolls sideways on a phone instead of squeezing its columns. */
export function Table({ head, children }: { head: ReactNode[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] border-collapse text-left text-[0.8125rem]">
        <thead>
          <tr className="border-b border-[var(--home-card-border)] text-[0.6875rem] uppercase tracking-wider text-[var(--home-muted)]">
            {head.map((h, i) => (
              <th key={i} className="px-4 py-2.5 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--home-card-border)]">{children}</tbody>
      </table>
    </div>
  )
}

export function timeAgo(time: number, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - time) / 1000))
  if (seconds < 60) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(time).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat().format(n)
}

/** Asks before something that cannot be undone. */
export function confirmAction(message: string): boolean {
  return typeof window !== 'undefined' && window.confirm(message)
}
