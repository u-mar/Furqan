'use client'

import { Megaphone, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import {
  dismissPopupForCurrentUser,
  getOrCreateUserProfile,
  getPendingPopupsForCurrentUser,
  trackUsage,
  type AdminPopupMessage,
} from '@/lib/admin'

export default function AdminRuntime() {
  const pathname = usePathname()
  const [activePopup, setActivePopup] = useState<AdminPopupMessage | null>(null)

  useEffect(() => {
    getOrCreateUserProfile()
  }, [])

  useEffect(() => {
    if (!pathname) return

    void trackUsage(pathname, { isActive: true })

    const heartbeat = () => {
      if (document.visibilityState === 'visible') {
        void trackUsage(pathname, { isActive: true })
      }
    }
    const interval = window.setInterval(heartbeat, 30_000)

    const onVisibility = () => {
      void trackUsage(pathname, {
        isActive: document.visibilityState === 'visible',
      })
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
      void trackUsage(pathname, { isActive: false })
    }
  }, [pathname])

  useEffect(() => {
    const loadPending = async () => {
      const list = await getPendingPopupsForCurrentUser()
      setActivePopup((current) => current ?? list[0] ?? null)
    }

    void loadPending()
    const timer = window.setInterval(() => void loadPending(), 6000)
    const sync = () => void loadPending()
    window.addEventListener('storage', sync)
    window.addEventListener('admin-store-changed', sync)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('storage', sync)
      window.removeEventListener('admin-store-changed', sync)
    }
  }, [])

  const createdAtLabel = useMemo(() => {
    if (!activePopup) return ''
    return new Date(activePopup.createdAt).toLocaleString()
  }, [activePopup])

  if (!activePopup) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] px-3 pt-[max(0.5rem,env(safe-area-inset-top))]">
      <div
        className="pointer-events-auto mx-auto w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--home-sage-deep)]/35 bg-[var(--home-card-bg)] shadow-lg shadow-black/15 dark:shadow-black/40"
        role="alertdialog"
        aria-labelledby="admin-popup-title"
        aria-describedby="admin-popup-body"
      >
        <div className="h-1 bg-gradient-to-r from-[var(--home-sage-deep)] via-teal-500 to-[var(--home-sage-deep)]" />
        <div className="px-4 py-3.5">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--home-sage-soft)] text-[var(--home-sage-deep)]">
              <Megaphone className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--home-sage-deep)]">
                Message from admin
              </p>
              <h3
                id="admin-popup-title"
                className="mt-0.5 text-base font-semibold leading-snug text-[var(--home-heading)]"
              >
                {activePopup.title}
              </h3>
              <p
                id="admin-popup-body"
                className="mt-2 text-sm leading-relaxed text-[var(--app-text)]"
              >
                {activePopup.body}
              </p>
              <p className="mt-2 text-[10px] text-[var(--home-muted)]">{createdAtLabel}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                void dismissPopupForCurrentUser(activePopup.id)
                setActivePopup(null)
              }}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--home-muted)] transition-colors hover:bg-[var(--app-surface)]"
              aria-label="Dismiss message"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
