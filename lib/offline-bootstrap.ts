import { getAppSettings, setAppSettings } from '@/lib/app-settings'
import {
  downloadOfflineQuran,
  hydrateOfflineFromDisk,
  isOfflineReady,
} from '@/lib/local-quran-store'
import { areTranslationsCached, downloadOfflineTranslations } from '@/lib/offline-translations'
import { tr } from '@/lib/i18n-core'
import { toast } from '@/lib/toast'

let bootstrapPromise: Promise<boolean> | null = null

/** What the first-launch download is doing, for the small card that shows it. */
export interface OfflineSaveState {
  active: boolean
  percent: number
  label: string
  /** Put away by the reader; the download carries on underneath. */
  hidden: boolean
}

const IDLE: OfflineSaveState = { active: false, percent: 0, label: '', hidden: false }
/** Share of the bar the mushaf takes when a translation follows it (it is far larger). */
const MUSHAF_SHARE = 85

let saveState: OfflineSaveState = IDLE
const listeners = new Set<() => void>()

function setSaveState(patch: Partial<OfflineSaveState>): void {
  saveState = { ...saveState, ...patch }
  listeners.forEach((listener) => listener())
}

export function subscribeOfflineSave(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getOfflineSave(): OfflineSaveState {
  return saveState
}

export function getServerOfflineSave(): OfflineSaveState {
  return IDLE
}

export function hideOfflineSave(): void {
  setSaveState({ hidden: true })
}

/**
 * Asks the phone to keep what the app has saved (the Quran text and the page
 * fonts) rather than clear it when storage runs low. Without this, Android may
 * quietly delete it and the mushaf would need the internet again. Installed
 * apps are usually granted it without a prompt.
 */
async function keepSavedQuran(): Promise<void> {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted?.())) await navigator.storage.persist()
  } catch {
    // Not offered on this browser: the saved Quran is simply kept as long as the browser allows.
  }
}

/** The reader's chosen translation, unless it is already on the phone. */
function translationToSave(): string | null {
  const editionId = getAppSettings().translationEditionId
  return editionId && !areTranslationsCached(editionId) ? editionId : null
}

/** Saves the chosen translation after the mushaf, so reading with it works offline too. */
async function saveTranslation(editionId: string, from: number): Promise<boolean> {
  try {
    await downloadOfflineTranslations(editionId, (p) =>
      setSaveState({ percent: Math.round(from + (p.percent * (100 - from)) / 100), label: p.label })
    )
    return true
  } catch {
    // The mushaf still works offline; the translation is fetched as pages are opened instead.
    return false
  }
}

/**
 * Puts the Quran text, the mushaf page fonts and the chosen translation on the
 * phone, the first time the app opens, and asks the phone to keep them.
 */
export async function bootstrapOfflineReader(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  if (bootstrapPromise) return bootstrapPromise

  if (isOfflineReady() || getAppSettings().offlineDownloaded) {
    void keepSavedQuran()
    // The mushaf is saved; a translation chosen since (or one that failed before) still may not be.
    const editionId = navigator.onLine ? translationToSave() : null
    if (!editionId) return true
    bootstrapPromise = (async () => {
      setSaveState({ active: true, hidden: false, percent: 0, label: tr('Saving the translation for offline reading') })
      try {
        await saveTranslation(editionId, 0)
        return true
      } finally {
        setSaveState(IDLE)
        bootstrapPromise = null
      }
    })()
    return bootstrapPromise
  }

  bootstrapPromise = (async () => {
    const editionId = translationToSave()
    const mushafShare = editionId ? MUSHAF_SHARE : 100
    setSaveState({ active: true, hidden: false, percent: 0, label: tr('Downloading Quran text…') })
    try {
      await downloadOfflineQuran((p) =>
        setSaveState({ percent: Math.round((p.percent * mushafShare) / 100), label: p.label })
      )
      await keepSavedQuran()
      setAppSettings({ offlineDownloaded: true })
      if (editionId) await saveTranslation(editionId, mushafShare)
      window.dispatchEvent(new CustomEvent('offline-bootstrap-complete', { detail: { ok: true } }))
      toast(tr('The Quran now works offline'), 'success')
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
      setSaveState(IDLE)
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
