'use client'

import Link from 'next/link'
import { Settings2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { IconCrescent, IconOrnament } from '@/components/home/TileIcons'
import { APP_NAME } from '@/lib/app-brand'

function formatGregorian(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date)
}

function formatHijri(date: Date): string {
  try {
    return new Intl.DateTimeFormat('en-TN-u-ca-islamic-umalqura', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date)
  } catch {
    return new Intl.DateTimeFormat('en', {
      calendar: 'islamic',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date)
  }
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
    <header className="reveal mb-9">
      {/* Masthead */}
      <div className="flex items-center justify-between gap-4">
        <p className="ed-label">{APP_NAME}</p>
        <Link
          href="/settings"
          className="ed-focus flex h-11 w-11 items-center justify-center rounded-full border border-[var(--home-rule-strong)] text-[var(--home-heading)] transition-colors hover:bg-[var(--home-ink)] hover:text-[var(--home-ink-fg)] active:scale-95"
          aria-label="Open settings"
        >
          <Settings2 className="h-[18px] w-[18px]" strokeWidth={1.75} />
        </Link>
      </div>

      {/* Greeting */}
      <div className="mt-7">
        <p
          className="amiri !text-left text-[1.6rem] leading-none text-[var(--home-sage-deep)]"
          dir="rtl"
        >
          ٱلسَّلَامُ عَلَيْكُمْ
        </p>
        <p className="home-serif mt-2 text-[0.95rem] italic text-[var(--home-muted)]">
          Peace be upon you,
        </p>
        <h1 className="home-serif mt-1 truncate text-[2.9rem] font-medium leading-[1.02] tracking-[-0.025em] text-[var(--home-heading)]">
          {displayName}
        </h1>
      </div>

      {/* Dateline */}
      <div className="mt-7 flex items-center gap-3">
        <span className="ed-rule flex-1" />
        <IconOrnament className="h-3 w-3 text-[var(--home-sage)]" />
        <span className="ed-rule flex-1" />
      </div>
      <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="flex items-center gap-2 text-[var(--home-heading)]">
          <IconCrescent className="h-3.5 w-3.5 text-[var(--home-sage)]" />
          <span className="home-serif text-[1.02rem] font-medium">{hijri || '…'}</span>
        </span>
        <span className="text-[0.8rem] text-[var(--home-muted)]">{gregorian || '…'}</span>
      </div>
    </header>
  )
}
