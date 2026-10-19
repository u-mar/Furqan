'use client'

import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import LocationOffNote from '@/components/prayer/LocationOffNote'
import QiblaCompass from '@/components/prayer/QiblaCompass'
import { useAutoLocate, usePrayerState } from '@/hooks/usePrayer'
import { BOTTOM_NAV_HEIGHT_REM } from '@/lib/bottom-nav'
import { useT } from '@/lib/i18n'

/**
 * Just the qibla — reached from its own tile on Home. The Prayer screen used
 * to hold this behind a tab; now each is its own focused screen instead of
 * two screens sharing one.
 */
export default function QiblaPage() {
  const t = useT()
  const { place, ready } = usePrayerState()
  const location = useAutoLocate(ready, place)

  return (
    <main className="min-h-[100dvh] bg-[var(--app-bg)] text-[var(--app-text)]">
      <div
        className="mx-auto w-full max-w-lg px-4 pt-[max(1rem,env(safe-area-inset-top))]"
        style={{ paddingBottom: `calc(${BOTTOM_NAV_HEIGHT_REM}rem + env(safe-area-inset-bottom) + 1.25rem)` }}
      >
        <header className="flex items-center gap-3">
          <Link href="/" className="home-round ed-focus" aria-label={t('Back')}>
            <ChevronLeft className="h-5 w-5" strokeWidth={1.9} />
          </Link>
          <h1 className="home-serif min-w-0 flex-1 truncate text-[1.625rem] font-semibold leading-tight tracking-[-0.02em] text-[var(--home-heading)]">
            {t('Qibla')}
          </h1>
        </header>

        <LocationOffNote status={location.status} place={place} onRetry={location.retry} />

        <div className="mt-4">
          <QiblaCompass place={place} />
        </div>
      </div>
    </main>
  )
}
