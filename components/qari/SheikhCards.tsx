'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { Mic } from 'lucide-react'
import { RECITERS } from '@/lib/reciters'
import { sheikhLetter, type Sheikh } from '@/lib/sheikhs'
import { tapFeedback } from '@/lib/haptics'
import { cn } from '@/lib/cn'
import { useT } from '@/lib/i18n'

export function plural(count: number, word: string, many = `${word}s`) {
  return `${count} ${count === 1 ? word : many}`
}

/**
 * The sheikh's portrait from Listen, faded in over the first letter of his
 * Arabic name — which stays when there is no picture or it fails to load.
 */
export function SheikhMonogram({ sheikh, size = 40, className }: { sheikh: Sheikh; size?: number; className?: string }) {
  const photo = sheikh.reciterId ? RECITERS.find((r) => r.id === sheikh.reciterId)?.photoUrl : undefined
  const [shown, setShown] = useState<string | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)

  // A cached picture can finish before hydration and its load event is gone.
  useEffect(() => {
    const img = imgRef.current
    if (img?.complete && img.naturalWidth > 0 && photo) setShown(photo)
  }, [photo])

  return (
    <span
      aria-hidden
      className={cn('qari-monogram relative overflow-hidden', className)}      style={{ width: size, height: size, fontSize: Math.round(size * 0.52), paddingBottom: Math.round(size * 0.18) }}
    >
      {sheikhLetter(sheikh)}
      {photo && failed !== photo ? (
        <img
          key={photo}
          ref={imgRef}
          src={photo}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => setShown(photo)}
          onError={() => setFailed(photo)}
          className="absolute inset-0 h-full w-full object-cover"
          style={{ opacity: shown === photo ? 1 : 0, transition: 'opacity 200ms ease' }}
        />
      ) : null}
    </span>
  )
}

/** A sheikh in the Imitations row. */
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
        'qari-enter qari-press ed-focus flex min-w-0 snap-start items-center gap-2.5 rounded-[18px] bg-[var(--home-card-bg)] p-3 shadow-[var(--home-lift-sm)]',
        fill ? 'flex-1' : 'w-[168px] shrink-0'
      )}
      style={{ animationDelay: `${index * 45}ms` }}
    >
      <SheikhMonogram sheikh={sheikh} size={40} />
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-[var(--home-heading)]">{sheikh.shortName}</span>
        <span className="mt-px block text-xs text-[var(--qari-gold)]">{plural(count, 'imitation')}</span>
      </span>
    </Link>
  )
}

/**
 * The top of a sheikh's page or search result: his portrait in a gold ring
 * over a band of gold stars, his name, how many have imitated him, and a way
 * to join in.
 */
export function SheikhHeader({
  sheikh,
  count,
  people,
}: {
  sheikh: Sheikh
  count: number | null
  people: number | null
}) {
  const t = useT()
  return (
    <section className="qari-enter home-card overflow-hidden rounded-[20px] text-center">
      <div className="qari-star-band h-[76px]" aria-hidden />
      <div className="-mt-12 px-4 pb-4">
        <span className="relative mx-auto block w-fit rounded-full bg-[var(--home-card-bg)] p-[3px] shadow-[inset_0_0_0_1.5px_var(--qari-gold)]">
          <SheikhMonogram sheikh={sheikh} size={84} />
        </span>
        <h2 className="home-serif mt-2.5 text-[21px] font-medium leading-tight tracking-[-0.015em] text-[var(--home-heading)]">
          {sheikh.name}
        </h2>
        <p className="mt-1 min-h-[1.25rem] text-[13px] text-[var(--home-muted)]">
          {count === null
            ? ''
            : count === 0
              ? t('No imitations yet')
              : t('{imitation} from {people}', { imitation: plural(count, 'imitation'), people: plural(people ?? 0, 'person', 'people') })}
        </p>
        <Link
          href={`/qari/record?imitate=${encodeURIComponent(sheikh.id)}`}
          onClick={tapFeedback}
          className="ed-ink ed-focus qari-press mt-3.5 flex h-11 items-center justify-center gap-2 rounded-full text-sm font-medium"
        >
          <Mic className="h-4 w-4" strokeWidth={2} />
          {t('Imitate')} {sheikh.shortName}
        </Link>
      </div>
    </section>
  )
}
