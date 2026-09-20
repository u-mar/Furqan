'use client'

import { useEffect, type ReactNode } from 'react'
import {
  applyThemeToDocument,
  getAppSettings,
  type AppSettings,
} from '@/lib/app-settings'
import { applyLanguageToDocument } from '@/lib/i18n'
import { hydrateOfflineFromDisk, isOfflineReady } from '@/lib/local-quran-store'

/*
 * Renders its children as they are from the very first render. It used to
 * wrap them in a <div> until this effect had run and then drop the wrapper;
 * that change of shape made React unmount and remount the whole app once on
 * every load, so every screen's requests went out twice. The theme is already
 * on the page before it draws (the script in the layout's <head>), and the
 * body paints its background, so the wrapper added nothing.
 */
export default function SettingsProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const settings = getAppSettings()
    applyThemeToDocument(settings.theme)
    applyLanguageToDocument(settings.language)

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
      applyLanguageToDocument(detail.language)
    }

    window.addEventListener('app-settings-changed', onChange)

    return () => {
      window.removeEventListener('app-settings-changed', onChange)
      window.clearTimeout(warmTimer)
      if (warmIdle !== undefined && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(warmIdle)
      }
    }
  }, [])

  return <>{children}</>
}
