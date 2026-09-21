'use client'

import { useEffect, useRef } from 'react'
import { Square, Volume2 } from 'lucide-react'
import { useAdhanPlaying, usePrayerState } from '@/hooks/usePrayer'
import { adhanAvailable, keepAdhanOffline, playAdhan, stopAdhan } from '@/lib/adhan-audio'
import { ADHAN_PRAYERS, nextPrayer, type PrayerId } from '@/lib/prayer'
import { useT } from '@/lib/i18n'

/** How late a prayer may be and still sound: a phone that slept through it should not wake up to it later. */
const GRACE_MS = 90_000

/**
 * Sounds the adhan when a prayer begins, from any screen, while the app is open.
 * A closed app cannot sound it: that needs the installed app's own scheduled
 * notifications. Also shows a small stop button while it plays.
 */
export default function AdhanHost() {
  const t = useT()
  const { place, settings, ready } = usePrayerState()
  const playing = useAdhanPlaying()
  const fired = useRef<string>('')

  // Keep the recording on the phone while there is a connection, so the adhan needs none.
  useEffect(() => {
    if (!ready || !settings.adhan) return
    const keep = () => void keepAdhanOffline()
    keep()
    window.addEventListener('online', keep)
    return () => window.removeEventListener('online', keep)
  }, [ready, settings.adhan])

  useEffect(() => {
    if (!ready || !settings.adhan) return
    let cancelled = false

    const check = async () => {
      const now = new Date()
      // The prayer that has just begun, or the one about to.
      const next = nextPrayer(place, settings, new Date(now.getTime() - GRACE_MS))
      const id: PrayerId = next.id
      if (!ADHAN_PRAYERS.includes(id) || !settings.adhanFor[id as Exclude<PrayerId, 'sunrise'>]) return
      const late = now.getTime() - next.at.getTime()
      if (late < 0 || late > GRACE_MS) return
      const key = `${id}-${next.at.toISOString()}`
      if (fired.current === key) return
      fired.current = key
      if (cancelled || !(await adhanAvailable())) return
      void playAdhan()
    }

    void check()
    const timer = window.setInterval(() => void check(), 4000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [ready, place, settings])

  if (!playing) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-[70] flex justify-center px-4">
      <button
        type="button"
        onClick={stopAdhan}
        className="ed-ink pointer-events-auto flex items-center gap-2.5 rounded-full py-2 pl-4 pr-2 text-sm font-semibold shadow-lg"
      >
        <Volume2 className="h-4 w-4" strokeWidth={2} />
        {t('Adhan')}
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15">
          <Square className="h-3 w-3 fill-current" strokeWidth={0} />
        </span>
        <span className="sr-only">{t('Stop the adhan')}</span>
      </button>
    </div>
  )
}
