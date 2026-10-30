'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { X } from 'lucide-react'
import {
  bootstrapOfflineReader,
  getOfflineSave,
  getServerOfflineSave,
  hideOfflineSave,
  subscribeOfflineSave,
} from '@/lib/offline-bootstrap'
import { ensureOfflineHydrated, isOfflineReady } from '@/lib/local-quran-store'
import { hasBundledQuran } from '@/lib/native-app'
import { getAppSettings } from '@/lib/app-settings'
import { forgetAsrModel } from '@/lib/asr/model-cache'
import { BOTTOM_NAV_HEIGHT_REM } from '@/lib/bottom-nav'
import { useT } from '@/lib/i18n'

/**
 * The whole mushaf is never downloaded on its own any more. The Play Store app
 * carries it inside (with the English and Somali translations, lib/native-app.ts);
 * on the website it is saved from Settings, when the person chooses. Here, once
 * the first screen has settled: in the app, the text is read into memory from
 * its own copy; wherever the mushaf is on the phone, a translation chosen since
 * is saved too. A small card shows a download's progress, and can be put away.
 */
export default function OfflineBootstrap() {
  // The speech model the Hifdh Test used is no longer part of the app; free the space where it was saved.
  useEffect(() => {
    void forgetAsrModel()
  }, [])

  useEffect(() => {
    const bundled = hasBundledQuran()
    if (!bundled && !isOfflineReady() && !getAppSettings().offlineDownloaded) return

    let idle: number | undefined
    const start = bundled
      ? () => void ensureOfflineHydrated().then((ready) => (ready ? bootstrapOfflineReader() : false))
      : () => void bootstrapOfflineReader()
    const timer = window.setTimeout(() => {
      if (typeof window.requestIdleCallback === 'function') idle = window.requestIdleCallback(start, { timeout: 4000 })
      else start()
    }, 3000)
    return () => {
      window.clearTimeout(timer)
      if (idle !== undefined && typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(idle)
    }
  }, [])

  return <OfflineSaveCard />
}

function OfflineSaveCard() {
  const t = useT()
  const { active, hidden, percent, label } = useSyncExternalStore(
    subscribeOfflineSave,
    getOfflineSave,
    getServerOfflineSave
  )
  if (!active || hidden) return null

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-4"
      style={{
        bottom: `calc(${BOTTOM_NAV_HEIGHT_REM}rem + max(0.75rem, env(safe-area-inset-bottom)) + var(--toast-lift, 0px))`,
      }}
    >
      <div
        role="status"
        aria-live="polite"
        className="fx-toast ed-ink pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl py-2.5 pl-4 pr-2"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2 text-sm font-semibold">
            <span className="truncate">{t('Saving the Quran for offline reading')}</span>
            <span className="shrink-0 tabular-nums">{percent}%</span>
          </div>
          <div
            className="mt-1.5 h-1 overflow-hidden rounded-full"
            style={{ background: 'color-mix(in srgb, currentColor 20%, transparent)' }}
            aria-hidden
          >
            <div
              className="h-full rounded-full bg-[var(--home-sage)] transition-[width] duration-300 ease-out"
              style={{ width: `${percent}%` }}
            />
          </div>
          {label ? <p className="mt-1 truncate text-[0.75rem] opacity-70">{label}</p> : null}
        </div>
        <button
          type="button"
          onClick={hideOfflineSave}
          className="ed-focus flex h-9 w-9 shrink-0 items-center justify-center rounded-full opacity-70 hover:opacity-100"
          aria-label={t('Hide')}
        >
          <X className="h-4 w-4" strokeWidth={2.2} />
        </button>
      </div>
    </div>
  )
}
