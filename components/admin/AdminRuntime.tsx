'use client'

import { X } from 'lucide-react'
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
    void trackUsage(pathname)
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
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] px-4">
      <div className="pointer-events-auto mx-auto w-full max-w-lg rounded-2xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] p-4 shadow-2xl">
        <div className="mb-2 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--home-sage-deep)]">
              Admin message
            </p>
            <h3 className="mt-1 text-sm font-semibold text-[var(--home-heading)]">{activePopup.title}</h3>
          </div>
          <button
            type="button"
            onClick={() => {
              void dismissPopupForCurrentUser(activePopup.id)
              setActivePopup(null)
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--home-muted)] transition-colors hover:bg-[var(--app-surface)]"
            aria-label="Dismiss message"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-sm leading-relaxed text-[var(--app-text)]">{activePopup.body}</p>
        <p className="mt-2 text-[11px] text-[var(--home-muted)]">{createdAtLabel}</p>
      </div>
    </div>
  )
}
