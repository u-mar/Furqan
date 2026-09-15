'use client'

import Link from 'next/link'
import { Mic } from 'lucide-react'
import { sheikhLetter, type Sheikh } from '@/lib/sheikhs'
import { tapFeedback } from '@/lib/haptics'
import { cn } from '@/lib/cn'

export function plural(count: number, word: string, many = `${word}s`) {
  return `${count} ${count === 1 ? word : many}`
}

/** A sheikh never has a photo: a letter of his Arabic name stands for him. */
export function SheikhMonogram({ sheikh, size = 40, className }: { sheikh: Sheikh; size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('qari-monogram', className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.52), paddingBottom: Math.round(size * 0.18) }}
    >
      {sheikhLetter(sheikh)}
    </span>
  )
}

/** A sheikh in the Imitations row. Names only — never a photo. */
export function SheikhCard({
  sheikh,
  count,
  index = 0,
  fill = false,
}: {
  sheikh: Sheikh
  count: number
  index?: number
  /** Share the row equally instead of keeping a fixed width. */
  fill?: boolean
}) {
  return (
    <Link
      href={`/qari/sheikh/${sheikh.id}`}
      onClick={tapFeedback}
      className={cn(
        'qari-enter qari-press ed-focus flex min-w-0 snap-start items-center gap-2.5 rounded-2xl bg-[var(--home-card-bg)] p-3 shadow-[var(--home-lift-sm)]',
        fill ? 'flex-1' : 'w-[164px] shrink-0'
      )}
      style={{ animationDelay: `${index * 45}ms` }}
    >
      <SheikhMonogram sheikh={sheikh} size={40} />
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-[var(--home-heading)]">{sheikh.shortName}</span>
        <span className="mt-px block text-[12.5px] text-[var(--home-muted)]">{plural(count, 'imitation')}</span>
      </span>
    </Link>
  )
}

/** The top of a sheikh's page or search result: who, how many, and a way to join in. */
export function SheikhHeader({
  sheikh,
  count,
  people,
}: {
  sheikh: Sheikh
  count: number | null
  people: number | null
}) {
  return (
    <section className="qari-enter home-card rounded-[18px] p-4">
      <div className="flex items-center gap-3.5">
        <SheikhMonogram sheikh={sheikh} size={56} />
        <div className="min-w-0">
          <h2 className="text-base font-semibold leading-snug text-[var(--home-heading)]">{sheikh.name}</h2>
          <p className="mt-0.5 min-h-[1.25rem] text-[13px] text-[var(--home-muted)]">
            {count === null
              ? ''
              : count === 0
                ? 'No imitations yet'
                : `${plural(count, 'imitation')} from ${plural(people ?? 0, 'person', 'people')}`}
          </p>
        </div>
      </div>
      <Link
        href={`/qari/record?imitate=${encodeURIComponent(sheikh.id)}`}
        onClick={tapFeedback}
        className="ed-ink ed-focus qari-press mt-3.5 flex h-12 items-center justify-center gap-2 rounded-full text-[14.5px] font-semibold"
      >
        <Mic className="h-[17px] w-[17px]" strokeWidth={2.1} />
        Imitate {sheikh.shortName}
      </Link>
    </section>
  )
}
