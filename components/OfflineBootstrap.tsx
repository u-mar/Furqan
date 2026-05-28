'use client'

import { useEffect } from 'react'
import { bootstrapOfflineReader, isStandaloneDisplayMode } from '@/lib/offline-bootstrap'
import { isOfflineReady } from '@/lib/local-quran-store'
import { getAppSettings } from '@/lib/app-settings'

/** Queues Quran offline data when the app runs as an installed PWA. */
export default function OfflineBootstrap() {
  useEffect(() => {
    if (!isStandaloneDisplayMode()) return
    if (isOfflineReady() || getAppSettings().offlineDownloaded) return
    void bootstrapOfflineReader()
  }, [])

  return null
}
