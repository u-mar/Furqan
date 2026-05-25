'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/cn'
import { IconQuranStand } from '@/components/home/TileIcons'

const slides = [
  {
    id: 2,
    title: 'Community',
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
    <span className="shrink-0 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-sky-700 shadow-md transition-transform hover:scale-[1.02] active:scale-[0.98]">
      {slide.cta}
    </span>
  )

  return (
    <section className={cn('mb-5 lg:mb-0 lg:flex lg:flex-col', className)}>
      <div className="relative flex-1 overflow-hidden rounded-2xl border border-sky-200/80 bg-gradient-to-br from-sky-500 via-cyan-400 to-blue-300 px-4 py-4 shadow-lg shadow-sky-100 lg:min-h-[140px] lg:px-6 lg:py-6">
        <div
          className="pointer-events-none absolute -right-6 -top-6 h-32 w-32 rounded-full bg-white/10 blur-2xl"
          aria-hidden
        />
        <div className="relative flex items-center gap-3">
          <IconQuranStand className="h-14 w-14 shrink-0 text-white/90" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-white/80">{slide.title}</p>
            <p className="text-2xl font-bold text-white lg:text-3xl">{slide.off}</p>
            <p className="text-sm text-white/90">{slide.price}</p>
          </div>
          <Link href={slide.href}>{ctaInner}</Link>
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
              'h-2 w-2 rounded-full transition-colors',
              i === active ? 'bg-sky-500' : 'bg-sky-200 hover:bg-sky-300'
            )}
          />
        ))}
      </div>
    </section>
  )
}
