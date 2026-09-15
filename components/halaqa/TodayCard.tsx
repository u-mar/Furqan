'use client'

import { Check } from 'lucide-react'
import { useCountUp } from '@/hooks/useCountUp'
import { cn } from '@/lib/cn'
import { localDay, longDay } from '@/lib/halaqa'

/**
 * "Have you read today?" — the daily question at the top of a halaqa.
 * Ticking it lands at once: the answer pops in with a drawn tick, and the
 * count and bar roll forward, while the server catches up behind.
 */
export default function TodayCard({
  readToday,
  justRead,
  readCount,
  total,
  onRead,
}: {
  readToday: boolean
  /** Ticked a moment ago on this screen, so the answer arrives with a little ceremony. */
  justRead: boolean
  readCount: number
  total: number
  onRead: () => void
}) {
  const shownCount = useCountUp(readCount)
  const notYet = Math.max(0, total - readCount)
  return (
    <section className="home-card rounded-[18px] px-4 pb-4 pt-3.5" aria-label="Today">
      <p className="text-[0.78125rem] font-semibold text-[var(--home-muted)]">{longDay(localDay())}</p>
      <h2 className="home-serif mt-1.5 text-[1.375rem] font-semibold tracking-[-0.015em] text-[var(--home-heading)]">
        Have you read today?
      </h2>

      <div className="mt-3.5">
        {readToday ? (
          <div
            className={cn(
              'flex h-12 items-center justify-center gap-2.5 rounded-full bg-[var(--home-sage-soft)] text-[0.90625rem] font-semibold text-[var(--home-sage-deep)]',
              justRead && 'fx-pop-in'
            )}
            role="status"
          >
            <span
              className={cn(
                'flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[var(--home-sage)] text-[var(--home-ink-fg)]',
                justRead && 'fx-ring'
              )}
            >
              <Check className={cn('h-[13px] w-[13px]', justRead && 'fx-draw')} strokeWidth={3.2} />
            </span>
            Yes, you read today
          </div>
        ) : (
          <button
            type="button"
            onClick={onRead}
            className="ed-ink ed-focus fx-press flex h-12 w-full items-center justify-center gap-2 rounded-full text-[0.90625rem] font-semibold"
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
          <span className="text-sm font-semibold tabular-nums text-[var(--home-heading)]">
            {shownCount} of {total} {readCount === 1 && total === 1 ? 'has' : 'have'} read
          </span>
          <span
            className={cn(
              'text-[0.78125rem]',
              notYet === 0 ? 'font-semibold text-[var(--home-sage-deep)]' : 'text-[var(--home-muted)]'
            )}
          >
            {notYet === 0 ? 'Everyone has read' : `${notYet} not yet`}
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--home-track)]">
          <div
            className="fx-bar h-full rounded-full bg-[var(--home-sage)]"
            style={{ width: `${total ? Math.round((readCount / total) * 100) : 0}%` }}
          />
        </div>
      </div>
    </section>
  )
}
