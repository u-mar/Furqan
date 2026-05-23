'use client'

import { MapPin } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/cn'

function formatGregorian(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date)
}

function formatHijri(date: Date): string {
  try {
    return new Intl.DateTimeFormat('en', {
      calendar: 'islamic-umalqura',
      day: 'numeric',
      month: 'long',
    }).format(date)
  } catch {
    return new Intl.DateTimeFormat('en', { calendar: 'islamic', day: 'numeric', month: 'long' }).format(
      date
    )
  }
}

export default function DateCard({ className }: { className?: string }) {
  const [hijri, setHijri] = useState('')
  const [gregorian, setGregorian] = useState('')

  useEffect(() => {
    const now = new Date()
    setHijri(formatHijri(now))
    setGregorian(formatGregorian(now))
  }, [])

  return (
    <section
      className={cn(
        'mb-4 overflow-hidden rounded-2xl border border-white/[0.06] bg-[#1c1c1e] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] lg:mb-0 lg:flex lg:min-h-[140px] lg:flex-col',
        className
      )}
    >
      <div className="relative flex-1 px-4 pb-3 pt-4 lg:px-5 lg:pt-5">
        <div className="relative z-10">
          <p className="text-lg font-semibold leading-tight text-white lg:text-xl">{hijri || '…'}</p>
          <p className="mt-0.5 text-sm font-medium text-emerald-400 lg:text-base">{gregorian || '…'}</p>
        </div>
        <div
          className="pointer-events-none absolute right-3 top-3 flex h-14 w-14 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-950/40"
          aria-hidden
        >
          <div className="relative h-8 w-8">
            <div className="absolute left-1/2 top-1/2 h-3 w-0.5 -translate-x-1/2 -translate-y-full origin-bottom rotate-[30deg] rounded-full bg-emerald-400/80" />
            <div className="absolute left-1/2 top-1/2 h-2 w-0.5 -translate-x-1/2 -translate-y-full rounded-full bg-white/30" />
            <div className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-400" />
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-white/[0.06] bg-[#2a1818] px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <MapPin className="h-4 w-4 shrink-0 text-red-500" />
          <span className="truncate text-xs text-stone-300">For accurate prayer time</span>
        </div>
        <button
          type="button"
          className="shrink-0 text-xs font-semibold text-red-400 transition-colors hover:text-red-300"
        >
          Enable location
        </button>
      </div>
    </section>
  )
}
