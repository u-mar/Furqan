'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { AlertCircle, Check } from 'lucide-react'
import { dismissToast, getServerToast, getToast, subscribeToast, type ToastMessage } from '@/lib/toast'

const SHOW_MS = { success: 2400, info: 2600, error: 4000 }
const LEAVE_MS = 200

/**
 * Where every toast appears. A new message replaces the last one straight
 * away; a message on its own slides out before it goes.
 */
export default function ToastHost() {
  const live = useSyncExternalStore(subscribeToast, getToast, getServerToast)
  const [shown, setShown] = useState<ToastMessage | null>(null)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    if (live) {
      setShown(live)
      setLeaving(false)
      const id = window.setTimeout(() => dismissToast(live.id), SHOW_MS[live.tone])
      return () => window.clearTimeout(id)
    }
    setLeaving(true)
    const id = window.setTimeout(() => {
      setShown(null)
      setLeaving(false)
    }, LEAVE_MS)
    return () => window.clearTimeout(id)
  }, [live])

  if (!shown) return null

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-[70] flex justify-center px-4"
      style={{ bottom: 'calc(max(1.25rem, env(safe-area-inset-bottom)) + var(--toast-lift, 0px))' }}
    >
      <div
        key={shown.id}
        role={shown.tone === 'error' ? 'alert' : 'status'}
        className={`fx-toast ed-ink flex max-w-sm items-center gap-2.5 rounded-full py-2.5 pl-3 pr-4 text-sm font-semibold ${leaving ? 'fx-toast--leave' : ''}`}
      >
        {shown.tone === 'success' ? (
          <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-[var(--home-sage)] text-[var(--home-ink-fg)]">
            <Check className="h-[13px] w-[13px]" strokeWidth={3.2} />
          </span>
        ) : shown.tone === 'error' ? (
          <AlertCircle className="h-5 w-5 shrink-0 text-rose-400 dark:text-rose-600" strokeWidth={2.2} />
        ) : null}
        <span className={shown.tone === 'info' ? 'pl-1' : ''}>{shown.message}</span>
      </div>
    </div>
  )
}
