'use client'

import { Check } from 'lucide-react'
import { localDay, longDay } from '@/lib/halaqa'

/** "Have you read today?" — the daily question at the top of a halaqa. */
export default function TodayCard({
  readToday,
  readCount,
  total,
  busy,
  onRead,
}: {
  readToday: boolean
  readCount: number
  total: number
  busy: boolean
  onRead: () => void
}) {
  const notYet = Math.max(0, total - readCount)
  return (
    <section className="home-card rounded-[18px] px-4 pb-4 pt-3.5" aria-label="Today">
      <p className="text-[0.78125rem] font-semibold text-[var(--home-muted)]">{longDay(localDay())}</p>
      <h2 className="home-serif mt-1.5 text-[1.375rem] font-semibold tracking-[-0.015em] text-[var(--home-heading)]">
        Have you read today?
      </h2>

      <div className="mt-3.5">
        {readToday ? (
          <div className="qari-enter flex h-12 items-center justify-center gap-2.5 rounded-full bg-[var(--home-sage-soft)] text-[0.90625rem] font-semibold text-[var(--home-sage-deep)]">
            <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[var(--home-sage)] text-[var(--home-ink-fg)]">
              <Check className="h-[13px] w-[13px]" strokeWidth={3.2} />
            </span>
            Yes, you read today
          </div>
        ) : (
          <button
            type="button"
            onClick={onRead}
            disabled={busy}
            className="ed-ink ed-focus flex h-12 w-full items-center justify-center gap-2 rounded-full text-[0.90625rem] font-semibold transition-transform active:scale-[0.98] disabled:opacity-60"
          >
            <Check className="h-[17px] w-[17px]" strokeWidth={2.1} />
            Yes, I read
          </button>
        )}
      </div>
      <p className="mt-2 text-center text-[0.78125rem] text-[var(--home-muted)]">
        {readToday ? 'Counted in all your halaqas.' : 'Reading in the app ticks this for you.'}
      </p>

      <div className="mt-3.5 border-t border-[var(--home-rule)] pt-3">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm font-semibold text-[var(--home-heading)]">
            {readCount} of {total} {readCount === 1 && total === 1 ? 'has' : 'have'} read
          </span>
          <span className="text-[0.78125rem] text-[var(--home-muted)]">
            {notYet === 0 ? 'Everyone has read' : `${notYet} not yet`}
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--home-track)]">
          <div
            className="h-full rounded-full bg-[var(--home-sage)] transition-[width] duration-500"
            style={{ width: `${total ? Math.round((readCount / total) * 100) : 0}%` }}
          />
        </div>
      </div>
    </section>
  )
}
