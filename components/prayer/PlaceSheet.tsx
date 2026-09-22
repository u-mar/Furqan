'use client'

import { useState } from 'react'
import { LocateFixed } from 'lucide-react'
import Radio from '@/components/settings/Radio'
import SettingsSheet from '@/components/settings/SettingsSheet'
import { tapFeedback } from '@/lib/haptics'
import { CITIES, locateDevice, savePlace, setLocationDenied, type Place } from '@/lib/prayer'
import { toastError } from '@/lib/toast'
import { tr, useT } from '@/lib/i18n'

/**
 * Where prayer times and the qibla are worked out from — shared by the
 * Prayer and Qibla screens so picking a place from either one keeps both in
 * step.
 */
export default function PlaceSheet({
  open,
  place,
  onClose,
}: {
  open: boolean
  place: Place
  onClose: () => void
}) {
  const t = useT()
  const [locating, setLocating] = useState(false)

  const findMe = async () => {
    setLocating(true)
    try {
      setLocationDenied(false)
      savePlace(await locateDevice())
      onClose()
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'failed'
      if (reason === 'denied') setLocationDenied(true)
      toastError(
        reason === 'denied'
          ? tr('Location is off for this app. Pick your city instead, or allow location in your phone’s settings.')
          : tr('Could not find your location. Pick your city instead.')
      )
    } finally {
      setLocating(false)
    }
  }

  return (
    <SettingsSheet
      open={open}
      title={t('Your location')}
      description={t('Prayer times and the qibla are worked out from where you are.')}
      onClose={onClose}
    >
      <button
        type="button"
        onClick={() => void findMe()}
        disabled={locating}
        className="ed-ink ed-focus qari-press flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold disabled:opacity-60"
      >
        <LocateFixed className="h-4 w-4" strokeWidth={2} />
        {locating ? t('Finding you…') : t('Use my location')}
      </button>
      <p className="mb-2 mt-5 text-xs font-semibold text-[var(--home-heading)]">{t('Or choose a city')}</p>
      <div className="max-h-[42vh] divide-y divide-[var(--home-rule)] overflow-y-auto rounded-2xl border border-[var(--home-rule)]">
        {CITIES.map((city: Place) => {
          const on = place.source === 'city' && place.name === city.name
          return (
            <button
              key={city.name}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => {
                tapFeedback()
                savePlace(city)
                onClose()
              }}
              className="set-row"
            >
              <span className="set-row__label">{t(city.name)}</span>
              <Radio on={on} />
            </button>
          )
        })}
      </div>
    </SettingsSheet>
  )
}
