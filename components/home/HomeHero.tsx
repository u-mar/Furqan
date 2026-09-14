'use client'

import Link from 'next/link'
import { SlidersHorizontal } from 'lucide-react'
import { useEffect, useState } from 'react'
import { IconCrescent } from '@/components/home/TileIcons'
import { formatHijri } from '@/lib/hijri'

/** e.g. "Sun 13 Sep" — the Hijri date leads, so this one stays short. */
function formatGregorian(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(date)
}

export default function HomeHero({ displayName }: { displayName: string }) {
  const [hijri, setHijri] = useState('')
  const [gregorian, setGregorian] = useState('')

  useEffect(() => {
    const now = new Date()
    setHijri(formatHijri(now))
    setGregorian(formatGregorian(now))
  }, [])

  return (
    <header className="reveal flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="amiri !text-left text-[1.3125rem] leading-[1.5] text-[var(--home-sage)]" dir="rtl">
          ٱلسَّلَامُ عَلَيْكُمْ
        </p>
        <h1 className="home-serif truncate text-[1.8125rem] font-semibold leading-[1.1] tracking-[-0.02em] text-[var(--home-heading)]">
          {displayName}
        </h1>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-[0.8125rem] text-[var(--home-muted)]">
          <IconCrescent className="h-[13px] w-[13px] shrink-0 text-[var(--home-sage)]" />
          <span className="font-semibold text-[var(--home-heading)]">{hijri || '…'}</span>
          {gregorian ? <span>· {gregorian}</span> : null}
        </p>
      </div>

      <Link href="/settings" className="home-round ed-focus" aria-label="Open settings">
        <SlidersHorizontal className="h-[18px] w-[18px]" strokeWidth={1.9} />
      </Link>
    </header>
  )
}
