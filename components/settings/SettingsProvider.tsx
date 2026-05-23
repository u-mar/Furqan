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

    if (settings.offlineDownloaded && !isOfflineReady()) {
      hydrateOfflineFromDisk().catch(() => {})
    }

    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<AppSettings>).detail
      applyThemeToDocument(detail.theme)
    }

    window.addEventListener('app-settings-changed', onChange)
    setReady(true)

    return () => window.removeEventListener('app-settings-changed', onChange)
  }, [])

  if (!ready) {
    return (
      <div className="min-h-[100dvh] bg-[var(--app-bg)] text-[var(--app-text)]">{children}</div>
    )
  }

  return <>{children}</>
}
