'use client'

import { useEffect, useState, type ReactNode } from 'react'
import {
  applyThemeToDocument,
  getAppSettings,
  type AppSettings,
} from '@/lib/app-settings'
import { hydrateOfflineFromDisk, isOfflineReady } from '@/lib/local-quran-store'

export default function SettingsProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const settings = getAppSettings()
    applyThemeToDocument(settings.theme)

    /* Warm the offline Quran for the reader, but only once the first screen has
       drawn and settled: parsing it freezes the page for a moment, and doing
       that during load held up everything on Home. The reader still loads it
       itself if it is opened before this runs. */
    let warmTimer: number | undefined
    let warmIdle: number | undefined
    if (settings.offlineDownloaded && !isOfflineReady()) {
      warmTimer = window.setTimeout(() => {
        const warm = () => void hydrateOfflineFromDisk().catch(() => {})
        if (typeof window.requestIdleCallback === 'function') {
          warmIdle = window.requestIdleCallback(warm, { timeout: 2000 })
        } else {
          warm()
        }
      }, 1500)
    }

    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<AppSettings>).detail
      applyThemeToDocument(detail.theme)
    }

    window.addEventListener('app-settings-changed', onChange)
    setReady(true)

    return () => {
      window.removeEventListener('app-settings-changed', onChange)
      window.clearTimeout(warmTimer)
      if (warmIdle !== undefined && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(warmIdle)
      }
    }
  }, [])

  if (!ready) {
    return (
      <div className="min-h-[100dvh] bg-[var(--app-bg)] text-[var(--app-text)]">{children}</div>
    )
  }

  return <>{children}</>
}
