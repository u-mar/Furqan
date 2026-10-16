'use client'

import { Check } from 'lucide-react'
import type { CSSProperties } from 'react'
import { useCountUp } from '@/hooks/useCountUp'
import { cn } from '@/lib/cn'
import { localDay, longDay, type HalaqaMemberView } from '@/lib/halaqa'
import { useT } from '@/lib/i18n'
import { MemberAvatar } from '@/components/halaqa/People'

/** The circle is drawn in a 288px square: people sit on a ring 118px out, today's progress 86px out. */
const BOX = 288
const SEAT_R = 118
const SEAT = 44
const RING_R = 86
const RING_LENGTH = 2 * Math.PI * RING_R
/** Past this many, the last seat says how many more there are. */
const MAX_SEATS = 10

/**
 * The top of a halaqa: its members seated in a circle, as a halaqa sits, each
 * lit in gold once they have read today, and today's count in the middle.
 * Beneath it, the one question the halaqa asks every day.
 */
export default function HalaqaCircle({
  people,
  readToday,
  justRead,
  onRead,
}: {
  /** Me first, then everyone by name. */
  people: HalaqaMemberView[]
  readToday: boolean
  /** Ticked a moment ago on this screen, so the answer arrives with a little ceremony. */
  justRead: boolean
  onRead: () => void
}) {
  const t = useT()
  const total = people.length
  const readCount = people.filter((p) => p.readToday).length
  const shown = useCountUp(readCount)
  const crowded = total > MAX_SEATS
  const seated = crowded ? people.slice(0, MAX_SEATS - 1) : people
  const seats = seated.length + (crowded ? 1 : 0)
  const share = total ? readCount / total : 0

  const seatAt = (index: number): CSSProperties => {
    const angle = -Math.PI / 2 + (index / seats) * 2 * Math.PI
    return {
      left: BOX / 2 + SEAT_R * Math.cos(angle) - SEAT / 2,
      top: BOX / 2 + SEAT_R * Math.sin(angle) - SEAT / 2,
    }
  }

  return (
    <section className="flex flex-col items-center" aria-label={t('Today')}>
      <div className="relative" style={{ width: BOX, height: BOX }}>
        <svg aria-hidden viewBox={`0 0 ${BOX} ${BOX}`} className="absolute inset-0 h-full w-full">
          <defs>
            <linearGradient id="hq-ring" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" className="hq-ring-stop-a" />
              <stop offset="1" className="hq-ring-stop-b" />
            </linearGradient>
          </defs>
          <circle cx={BOX / 2} cy={BOX / 2} r={SEAT_R} className="hq-circle__line" />
          <circle cx={BOX / 2} cy={BOX / 2} r={RING_R} className="hq-circle__track" />
          <circle
            cx={BOX / 2}
            cy={BOX / 2}
            r={RING_R}
            className="hq-circle__progress"
            stroke="url(#hq-ring)"
            strokeDasharray={RING_LENGTH}
            strokeDashoffset={RING_LENGTH * (1 - share)}
            transform={`rotate(-90 ${BOX / 2} ${BOX / 2})`}
          />
        </svg>

        {/* An open book at the centre, the count of who has read today beneath it */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <svg aria-hidden width="26" height="18" viewBox="0 0 26 18" className="hq-circle__book">
            <path d="M12 3.2C9.4 1.6 6.3 1 2.8 1.2a1 1 0 0 0-.9 1v11.6c0 .6.5 1 1 1 3.3-.1 6.2.6 9.1 2.1V3.2z" />
            <path d="M14 3.2c2.6-1.6 5.7-2.2 9.2-2a1 1 0 0 1 .9 1v11.6c0 .6-.5 1-1 1-3.3-.1-6.2.6-9.1 2.1V3.2z" />
          </svg>
          <p className="mt-1.5 flex items-baseline tabular-nums" dir="ltr" aria-live="polite">
            <span className="home-serif text-[3.25rem] font-medium leading-none tracking-[-0.03em] text-[var(--hv-text)]">{shown}</span>
            <span className="home-serif ms-1 text-[1.375rem] font-medium leading-none text-[var(--hv-text3)]">/{total}</span>
          </p>
          <p className="mt-1.5 text-[0.625rem] font-semibold uppercase tracking-[0.2em] text-[var(--hv-text3)]">{t('read today')}</p>
        </div>

        {seated.map((person, i) => {
          const arrived = justRead && person.isMe
          return (
            <span
              key={person.id}
              className={cn(
                'hq-seat',
                person.readToday ? 'hq-seat--read' : 'hq-seat--waiting',
                person.isMe && 'hq-seat--me',
                arrived && 'fx-pop-in'
              )}
              style={seatAt(i)}
              title={person.name}
            >
              <MemberAvatar name={person.name} size={SEAT} read={person.readToday} me={person.isMe} pop={arrived} />
            </span>
          )
        })}
        {crowded ? (
          <span className="hq-seat hq-seat--more" style={seatAt(seats - 1)}>
            +{total - seated.length}
          </span>
        ) : null}
      </div>

      <p className="mt-3 text-[0.75rem] font-medium tracking-[0.02em] text-[var(--hv-text3)]">{longDay(localDay())}</p>

      {readToday ? (
        <div className={cn('hq-done mt-3', justRead && 'fx-pop-in')} role="status">
          <span className={cn('hq-done__tick', justRead && 'fx-ring')}>
            <Check className={cn('h-[13px] w-[13px]', justRead && 'fx-draw')} strokeWidth={3.2} />
          </span>
          {t('Yes, you read today')}
        </div>
      ) : (
        <>
          <h2 className="home-serif mt-1 text-[1.375rem] font-medium tracking-[-0.015em] text-[var(--hv-text)]">
            {t('Have you read today?')}
          </h2>
          <button type="button" onClick={onRead} className="hq-cta ed-focus fx-press mt-3.5">
            <Check className="h-[17px] w-[17px]" strokeWidth={2.4} />
            {t('Yes, I read')}
          </button>
        </>
      )}
      <p className="mt-2.5 text-center text-[0.75rem] text-[var(--hv-text3)]">
        {readToday ? t('Counted in all your halaqas.') : t('Reading in the app ticks this for you.')}
      </p>
    </section>
  )
}
