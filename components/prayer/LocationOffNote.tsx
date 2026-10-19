'use client'

import type { LocateStatus } from '@/hooks/usePrayer'
import type { Place } from '@/lib/prayer'
import { useT } from '@/lib/i18n'

/**
 * There is no place to pick: prayer times and the qibla follow the phone's
 * position. This one quiet line appears only when that position cannot be
 * had, saying which place is used instead. While the phone can still ask, a
 * tap asks again; once location is blocked, only the phone's settings can
 * turn it back on.
 */
export default function LocationOffNote({
  status,
  place,
  onRetry,
}: {
  status: LocateStatus
  place: Place
  onRetry: () => void
}) {
  const t = useT()
  if (status !== 'off' && status !== 'blocked') return null
  const name = place.name || 'Mogadishu'

  if (status === 'blocked') {
    return (
      <p className="mx-1 mt-3 text-[0.8125rem] leading-snug text-[var(--home-muted)]">
        {t('Location is blocked, so {place} is used. Allow it in your phone’s settings.', { place: name })}
      </p>
    )
  }

  return (
    <button
      type="button"
      onClick={onRetry}
      className="ed-focus mx-1 mt-3 block w-full text-left text-[0.8125rem] leading-snug text-[var(--home-muted)] underline decoration-[var(--home-rule-strong)] underline-offset-2"
    >
      {t('Location is off, so {place} is used. Tap to turn it on.', { place: name })}
    </button>
  )
}
