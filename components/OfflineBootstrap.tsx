'use client'

import { useEffect } from 'react'
import { bootstrapOfflineReader, isStandaloneDisplayMode } from '@/lib/offline-bootstrap'
import { isOfflineReady } from '@/lib/local-quran-store'
import { getAppSettings } from '@/lib/app-settings'

/**
 * Puts the whole Quran on the phone without anyone asking: the text (about
 * 16 MB) and the mushaf page fonts. It starts once the first screen has
 * settled, since reading that much data briefly holds the page still, and it
 * leaves a metered connection alone until the app is installed or on Wi‑Fi.
 */
export default function OfflineBootstrap() {
  useEffect(() => {
    if (isOfflineReady() || getAppSettings().offlineDownloaded) return

    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; type?: string } }).connection
    const metered = Boolean(connection?.saveData) || connection?.type === 'cellular'
    if (metered && !isStandaloneDisplayMode()) return

    let idle: number | undefined
    const start = () => void bootstrapOfflineReader()
    const timer = window.setTimeout(() => {
      if (typeof window.requestIdleCallback === 'function') idle = window.requestIdleCallback(start, { timeout: 4000 })
      else start()
    }, 3000)
    return () => {
      window.clearTimeout(timer)
      if (idle !== undefined && typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(idle)
    }
  }, [])

  return null
}
