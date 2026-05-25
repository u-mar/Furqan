'use client'

import { MapPin, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { cn } from '@/lib/cn'
import { getSavedLocation, requestUserLocation, type UserLocation } from '@/lib/location'

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
  const [location, setLocation] = useState<UserLocation | null>(null)
  const [locLoading, setLocLoading] = useState(false)
  const [locError, setLocError] = useState<string | null>(null)

  useEffect(() => {
    const now = new Date()
    setHijri(formatHijri(now))
    setGregorian(formatGregorian(now))
    setLocation(getSavedLocation())
  }, [])

  const enableLocation = useCallback(async () => {
    setLocLoading(true)
    setLocError(null)
    try {
      const loc = await requestUserLocation()
      setLocation(loc)
    } catch (err) {
      setLocError(err instanceof Error ? err.message : 'Could not enable location')
    } finally {
      setLocLoading(false)
    }
  }, [])

  return (
    <section
      className={cn(
        'mb-4 overflow-hidden rounded-2xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] shadow-[var(--home-card-shadow)] lg:mb-0 lg:flex lg:min-h-[140px] lg:flex-col',
        className
      )}
    >
      <div className="relative flex-1 px-4 pb-3 pt-4 lg:px-5 lg:pt-5">
        <div className="relative z-10">
          <p className="text-lg font-semibold leading-tight text-[var(--app-text)] lg:text-xl">
            {hijri || '…'}
          </p>
          <p className="mt-0.5 text-sm font-medium text-teal-600 lg:text-base">
            {gregorian || '…'}
          </p>
        </div>
        <div
          className="pointer-events-none absolute right-3 top-3 flex h-14 w-14 items-center justify-center rounded-full border border-teal-500/20 bg-teal-500/10"
          aria-hidden
        >
          <div className="relative h-8 w-8">
            <div className="absolute left-1/2 top-1/2 h-3 w-0.5 -translate-x-1/2 -translate-y-full origin-bottom rotate-[30deg] rounded-full bg-teal-500/80" />
            <div className="absolute left-1/2 top-1/2 h-2 w-0.5 -translate-x-1/2 -translate-y-full rounded-full bg-[var(--app-muted)]/40" />
            <div className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-teal-500" />
          </div>
        </div>
      </div>
      <div className="border-t border-[var(--home-card-border)] bg-[var(--home-location-bg)] px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <MapPin className="h-4 w-4 shrink-0 text-teal-500" />
            <span className="truncate text-xs text-[var(--app-muted)]">
              {location ? location.label : 'For accurate prayer time'}
            </span>
          </div>
          {location ? (
            <span className="shrink-0 text-xs font-medium text-teal-600">
              Enabled
            </span>
          ) : (
            <button
              type="button"
              onClick={enableLocation}
              disabled={locLoading}
              className="flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-teal-600 transition-colors hover:bg-teal-50 active:bg-teal-100 disabled:opacity-60"
            >
              {locLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : null}
              Enable location
            </button>
          )}
        </div>
        {locError && <p className="mt-2 text-[11px] leading-snug text-red-500">{locError}</p>}
      </div>
    </section>
  )
}
