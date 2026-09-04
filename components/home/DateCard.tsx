'use client'

import { MapPin, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { cn } from '@/lib/cn'
import { IconCrescent } from '@/components/home/TileIcons'
import { getSavedLocation, requestUserLocation, type UserLocation } from '@/lib/location'
import { formatHijri } from '@/lib/hijri'

function formatGregorian(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date)
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
        'ed-card mb-4 overflow-hidden rounded-[1.25rem] lg:mb-0 lg:flex lg:min-h-[140px] lg:flex-col',
        className
      )}
    >
      <div className="relative flex-1 px-4 pb-3 pt-4 lg:px-5 lg:pt-5">
        <div className="relative z-10 pr-14">
          <p className="home-serif text-lg font-medium leading-tight text-[var(--home-heading)] lg:text-xl">
            {hijri || '…'}
          </p>
          <p className="mt-0.5 text-sm text-[var(--home-muted)] lg:text-base">{gregorian || '…'}</p>
        </div>
        <div
          className="pointer-events-none absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--home-sage-soft)] text-[var(--home-sage-deep)]"
          aria-hidden
        >
          <IconCrescent className="h-5 w-5" />
        </div>
      </div>
      <div className="border-t border-[var(--home-rule)] bg-[var(--home-location-bg)] px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <MapPin className="h-4 w-4 shrink-0 text-[var(--home-sage-deep)]" strokeWidth={1.75} />
            <span className="truncate text-xs text-[var(--home-muted)]">
              {location ? location.label : 'For accurate prayer time'}
            </span>
          </div>
          {location ? (
            <span className="shrink-0 text-xs font-semibold text-[var(--home-sage-deep)]">Enabled</span>
          ) : (
            <button
              type="button"
              onClick={enableLocation}
              disabled={locLoading}
              className="ed-focus flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-[var(--home-sage-deep)] transition-colors hover:bg-[var(--home-sage-soft)] disabled:opacity-60"
            >
              {locLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Enable location
            </button>
          )}
        </div>
        {locError && <p className="mt-2 text-[11px] leading-snug text-red-500">{locError}</p>}
      </div>
    </section>
  )
}
