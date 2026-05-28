import { getAppSettings, setAppSettings } from '@/lib/app-settings'
import {
  downloadOfflineQuran,
  hydrateOfflineFromDisk,
  isOfflineReady,
} from '@/lib/local-quran-store'

let bootstrapPromise: Promise<boolean> | null = null

/** Download Quran text + mushaf fonts after PWA install (or first standalone open). */
export async function bootstrapOfflineReader(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  if (isOfflineReady() || getAppSettings().offlineDownloaded) return true
  if (bootstrapPromise) return bootstrapPromise

  bootstrapPromise = (async () => {
    try {
      await downloadOfflineQuran()
      setAppSettings({ offlineDownloaded: true })
      window.dispatchEvent(new CustomEvent('offline-bootstrap-complete', { detail: { ok: true } }))
      return true
    } catch {
      try {
        await hydrateOfflineFromDisk()
        setAppSettings({ offlineDownloaded: true })
        window.dispatchEvent(new CustomEvent('offline-bootstrap-complete', { detail: { ok: true } }))
        return true
      } catch {
        window.dispatchEvent(new CustomEvent('offline-bootstrap-complete', { detail: { ok: false } }))
        return false
      }
    } finally {
      bootstrapPromise = null
    }
  })()

  return bootstrapPromise
}

export function isStandaloneDisplayMode(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}
