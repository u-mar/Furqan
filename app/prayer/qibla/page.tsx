'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ChevronLeft, MapPin } from 'lucide-react'
import PlaceSheet from '@/components/prayer/PlaceSheet'
import QiblaCompass from '@/components/prayer/QiblaCompass'
import { useAutoLocate, usePrayerState } from '@/hooks/usePrayer'
import { useT } from '@/lib/i18n'

/**
 * Just the qibla — reached from its own tile on Home. The Prayer screen used
 * to hold this behind a tab; now each is its own focused screen instead of
 * two screens sharing one.
 */
export default function QiblaPage() {
  const t = useT()
  const { place, ready } = usePrayerState()
  const [placeSheetOpen, setPlaceSheetOpen] = useState(false)

  useAutoLocate(ready, place)

  const placeLabel = place.name ? place.name : t('Your location')

  return (
    <main className="min-h-[100dvh] bg-[var(--app-bg)] text-[var(--app-text)]">
      <div className="mx-auto w-full max-w-lg px-4 pb-[max(1.75rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
        <header className="flex items-center gap-3">
          <Link href="/" className="home-round ed-focus" aria-label={t('Back')}>
            <ChevronLeft className="h-5 w-5" strokeWidth={1.9} />
          </Link>
          <h1 className="home-serif min-w-0 flex-1 truncate text-[1.625rem] font-semibold leading-tight tracking-[-0.02em] text-[var(--home-heading)]">
            {t('Qibla')}
          </h1>
          <button
            type="button"
            onClick={() => setPlaceSheetOpen(true)}
            className="prayer-pill home-press ed-focus"
            aria-label={t('Your location')}
          >
            <MapPin className="h-4 w-4 shrink-0 text-[var(--home-sage-deep)]" strokeWidth={2} />
            <span className="truncate">{placeLabel}</span>
          </button>
        </header>

        {ready && place.source === 'default' ? (
          <button
            type="button"
            onClick={() => setPlaceSheetOpen(true)}
            className="ed-focus mx-1 mt-3 block w-full text-left text-[0.8125rem] text-[var(--home-muted)] underline decoration-[var(--home-rule-strong)] underline-offset-2"
          >
            {t('Using Mogadishu. Tap to use your own location.')}
          </button>
        ) : null}

        <div className="home-card mt-4 rounded-[18px] px-4 py-6">
          <QiblaCompass place={place} />
        </div>
      </div>

      <PlaceSheet open={placeSheetOpen} place={place} onClose={() => setPlaceSheetOpen(false)} />
    </main>
  )
}
