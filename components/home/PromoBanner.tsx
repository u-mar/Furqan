'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/cn'
import { IconQuranStand } from '@/components/home/TileIcons'

const slides = [
  {
    id: 2,
    title: 'Hifdh Practice',
    off: 'Test mode',
    price: 'Free',
    cta: 'Try now',
    href: '/test/select',
  },
  {
    id: 3,
    title: 'Read Mushaf',
    off: '604 pages',
    price: 'Offline',
    cta: 'Open',
    href: '/read',
  },
]

export default function PromoBanner({ className }: { className?: string }) {
  const [active, setActive] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => {
      setActive((i) => (i + 1) % slides.length)
    }, 5000)
    return () => window.clearInterval(id)
  }, [])

  const slide = slides[active]

  const ctaInner = (
    <span className="ed-ink inline-flex h-10 shrink-0 items-center rounded-full px-4 text-sm font-semibold transition-transform hover:scale-[1.03] active:scale-95">
      {slide.cta}
    </span>
  )

  return (
    <section className={cn('mb-5 lg:mb-0 lg:flex lg:flex-col', className)}>
      <div className="ed-card ed-frame relative flex-1 overflow-hidden rounded-[1.25rem] px-4 py-4 lg:min-h-[140px] lg:px-6 lg:py-6">
        <div className="relative flex items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--home-sage-soft)] text-[var(--home-sage-deep)]">
            <IconQuranStand className="h-9 w-9" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="ed-label">{slide.title}</p>
            <p className="home-serif mt-1 text-2xl font-medium leading-tight text-[var(--home-heading)] lg:text-3xl">
              {slide.off}
            </p>
            <p className="mt-0.5 text-sm text-[var(--home-muted)]">{slide.price}</p>
          </div>
          <Link href={slide.href} className="ed-focus rounded-full">
            {ctaInner}
          </Link>
        </div>
      </div>
      <div className="mt-3 flex justify-center gap-1.5">
        {slides.map((s, i) => (
          <button
            key={s.id}
            type="button"
            aria-label={`Slide ${i + 1}`}
            onClick={() => setActive(i)}
            className={cn(
              'h-1.5 rounded-full transition-all',
              i === active ? 'w-5 bg-[var(--home-sage)]' : 'w-1.5 bg-[var(--home-track)] hover:bg-[var(--home-rule-strong)]'
            )}
          />
        ))}
      </div>
    </section>
  )
}
