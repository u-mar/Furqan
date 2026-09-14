'use client'

import Link from 'next/link'
import { Mic, MicVocal } from 'lucide-react'
import type { Sheikh } from '@/lib/sheikhs'
import { cn } from '@/lib/cn'

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}

/** A sheikh in the "Popular imitations" row. Names only — never a photo. */
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
      className={cn(
        'qari-enter qari-press ed-card ed-focus flex min-w-0 snap-start items-center gap-2.5 rounded-2xl p-3',
        fill ? 'flex-1' : 'w-[172px] shrink-0'
      )}
      style={{ animationDelay: `${index * 45}ms` }}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--home-sage-soft)] text-[var(--home-sage)]">
        <MicVocal className="h-[19px] w-[19px]" strokeWidth={2} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-[var(--home-heading)]">{sheikh.shortName}</span>
        <span className="mt-0.5 block text-[12.5px] text-[var(--home-muted)]">{plural(count, 'imitation')}</span>
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
    <section className="qari-enter ed-card rounded-[1.15rem] p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[14px] bg-[var(--home-sage-soft)] text-[var(--home-sage)]">
          <MicVocal className="h-6 w-6" strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-bold leading-snug text-[var(--home-heading)]">{sheikh.name}</h2>
          <p className="mt-0.5 text-[13px] text-[var(--home-muted)]">
            {count === null
              ? ' '
              : count === 0
                ? 'No imitations yet'
                : `${plural(count, 'imitation')} from ${plural(people ?? 0, 'person').replace('persons', 'people')}`}
          </p>
        </div>
      </div>
      <Link
        href={`/qari/record?imitate=${encodeURIComponent(sheikh.id)}`}
        className="ed-ink ed-focus qari-press mt-3.5 flex h-11 items-center justify-center gap-2 rounded-full text-sm font-bold"
      >
        <Mic className="h-4 w-4" strokeWidth={2.2} />
        Imitate {sheikh.shortName}
      </Link>
    </section>
  )
}
