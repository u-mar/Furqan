'use client'

import Link from 'next/link'
import { Settings2 } from 'lucide-react'
import { useEffect, useState } from 'react'

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

/** Ornamental eight-point-star lattice behind the greeting. */
function HeroPattern() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.16]"
      viewBox="0 0 400 240"
      fill="none"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <defs>
        <pattern
          id="hero-stars"
          width="48"
          height="48"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(15)"
        >
          <path
            d="M24 4l3 12 12 3-12 3-3 12-3-12-12-3 12-3 3-12z"
            stroke="#f4d59b"
            strokeWidth="1"
            fill="none"
          />
        </pattern>
      </defs>
      <rect width="400" height="240" fill="url(#hero-stars)" />
    </svg>
  )
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
    <header className="reveal mb-7">
      <div
        className="gold-sheen relative overflow-hidden rounded-[1.9rem] px-5 pb-6 pt-5 text-white shadow-[0_26px_60px_-20px_rgba(58,42,128,0.85)] ring-1 ring-white/10"
        style={{ background: 'var(--home-sage-gradient)' }}
      >
        <HeroPattern />
        {/* light blooms */}
        <div
          className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full bg-[#e2ab53]/25 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-20 -left-10 h-44 w-44 rounded-full bg-[#6a4bd0]/40 blur-3xl"
          aria-hidden
        />

        <div className="relative">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="amiri !text-left text-[1.35rem] leading-none text-[#f4d59b]" dir="rtl">
                ٱلسَّلَامُ عَلَيْكُمْ
              </p>
              <p className="mt-2 text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-white/55">
                Peace be upon you
              </p>
            </div>
            <Link
              href="/settings"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-2xl bg-white/12 text-white ring-1 ring-white/15 backdrop-blur-sm transition-all hover:bg-white/22 active:scale-95"
              aria-label="Open settings"
            >
              <Settings2 className="h-5 w-5" strokeWidth={1.9} />
            </Link>
          </div>

          <h1 className="home-serif mt-3.5 truncate text-[2.5rem] font-semibold leading-[1.05] text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.28)]">
            {displayName}
          </h1>

          <div className="mt-5 flex items-center gap-3 rounded-2xl bg-white/10 px-3.5 py-3 ring-1 ring-white/12 backdrop-blur-md">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#f4d59b] to-[#e2ab53] text-[#2a2258] shadow-[0_6px_16px_-6px_rgba(226,171,83,0.8)]">
              {/* crescent moon */}
              <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
                <path
                  fill="currentColor"
                  d="M15.5 2a9.5 9.5 0 1 0 6.5 16.4A7.5 7.5 0 0 1 13 6.6 9.5 9.5 0 0 1 15.5 2z"
                />
              </svg>
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-white">
                {hijri || '…'}
              </span>
              <span className="block truncate text-xs text-white/65">{gregorian || '…'}</span>
            </span>
          </div>
        </div>
      </div>
    </header>
  )
}
