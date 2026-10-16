'use client'

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { useCountUp } from '@/hooks/useCountUp'
import { cn } from '@/lib/cn'
import { shortDay, type HalaqaDetail } from '@/lib/halaqa'
import { useT } from '@/lib/i18n'

type Khatmah = NonNullable<HalaqaDetail['khatmah']>

/**
 * The halaqa's khatmah as a shelf of thirty spines, one per juz: gold once
 * read, teal for yours, outlined while someone has it, faint while free.
 * The whole card opens the khatmah.
 */
export default function KhatmahShelf({ halaqaId, khatmah }: { halaqaId: string; khatmah: Khatmah }) {
  const t = useT()
  const done = useCountUp(khatmah.done)
  const byJuz = new Map(khatmah.juz.map((j) => [j.juz, j]))
  const myJuz = khatmah.juz.find((j) => j.mine && !j.done)
  const complete = Boolean(khatmah.completedAt)

  return (
    <Link href={`/halaqa/${halaqaId}/khatmah`} className="hv-card home-press ed-focus block rounded-[1.375rem] px-4 pb-3.5 pt-3.5">
      <span className="flex items-center justify-between gap-3">
        <span className="text-[0.65625rem] font-semibold uppercase tracking-[0.2em] text-[var(--hv-text3)]">{t('Khatmah')}</span>
        {khatmah.finishBy && !complete ? (
          <span className="text-[0.75rem] text-[var(--hv-text3)]">
            {t('by')} {shortDay(khatmah.finishBy)}
          </span>
        ) : null}
      </span>

      <span className="mt-1.5 flex items-baseline gap-1.5">
        {complete ? (
          <span className="home-serif text-[1.375rem] font-medium tracking-[-0.015em]">{t('Khatmah complete')}</span>
        ) : (
          <>
            <span className="home-serif text-[1.75rem] font-medium leading-none tracking-[-0.02em] tabular-nums">{done}</span>
            <span className="text-[0.84375rem] text-[var(--hv-text2)]">{t('of 30 juz done')}</span>
          </>
        )}
      </span>

      {/* Thirty spines on a shelf */}
      <span className="hq-shelf mt-3.5" aria-hidden>
        {Array.from({ length: 30 }, (_, i) => {
          const juz = byJuz.get(i + 1)
          return (
            <span
              key={i}
              className={cn(
                'hq-spine',
                juz?.done ? 'hq-spine--done' : juz?.mine ? 'hq-spine--mine' : juz ? 'hq-spine--taken' : 'hq-spine--free'
              )}
            />
          )
        })}
      </span>
      <span className="mt-1 flex justify-between text-[0.625rem] tabular-nums text-[var(--hv-text3)]" aria-hidden>
        <span>1</span>
        <span>30</span>
      </span>

      {!complete ? (
        <span className="mt-3 flex items-center gap-3 border-t border-[var(--hv-border)] pt-3">
          {myJuz ? (
            <span className="home-serif flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg bg-[var(--hv-teal)] text-sm font-semibold text-[var(--hv-on-teal)]">
              {myJuz.juz}
            </span>
          ) : null}
          <span className="flex-1 text-[0.875rem] font-semibold">{myJuz ? t('Your juz') : t('Take a juz')}</span>
          <span className="text-[0.8125rem] text-[var(--hv-text2)]">
            {myJuz ? t('Juz {juz}', { juz: myJuz.juz }) : t('{count} free', { count: 30 - khatmah.juz.length })}
          </span>
          <ChevronRight className="h-[17px] w-[17px] shrink-0 text-[var(--hv-text3)] rtl:-scale-x-100" strokeWidth={2} />
        </span>
      ) : null}
    </Link>
  )
}
