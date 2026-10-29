'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { CheckCircle2, Download } from 'lucide-react'
import {
  bootstrapOfflineReader,
  getOfflineSave,
  getServerOfflineSave,
  subscribeOfflineSave,
} from '@/lib/offline-bootstrap'
import { isOfflineReady } from '@/lib/local-quran-store'
import { getAppSettings } from '@/lib/app-settings'
import { useT } from '@/lib/i18n'

/**
 * Settings -> Reading: the whole mushaf saved on the phone, so every page of Read
 * opens at once and works offline. The Play Store app does this on its own on
 * Wi‑Fi; here anyone can start it, on any connection.
 */
export default function OfflineQuranRow() {
  const t = useT()
  const save = useSyncExternalStore(subscribeOfflineSave, getOfflineSave, getServerOfflineSave)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const check = () => setSaved(isOfflineReady() || Boolean(getAppSettings().offlineDownloaded))
    check()
    window.addEventListener('offline-bootstrap-complete', check)
    return () => window.removeEventListener('offline-bootstrap-complete', check)
  }, [])

  return (
    <div className="set-row">
      <span className="set-row__icon" aria-hidden>
        {saved ? <CheckCircle2 className="h-[17px] w-[17px]" strokeWidth={1.9} /> : <Download className="h-[17px] w-[17px]" strokeWidth={1.9} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.9375rem] font-medium">{t('Quran on this phone')}</span>
        <span className="block text-[0.78125rem] leading-snug text-[var(--home-muted)]">
          {saved
            ? t('Saved. Every page opens at once, even offline.')
            : save.active
              ? `${save.percent}% · ${save.label}`
              : t('About 110 MB, once. Then every page opens at once, even offline.')}
        </span>
      </span>
      {!saved ? (
        <button
          type="button"
          disabled={save.active}
          onClick={() => void bootstrapOfflineReader()}
          className="ed-ink ed-focus h-9 shrink-0 rounded-full px-4 text-[0.8125rem] font-semibold disabled:opacity-60"
        >
          {save.active ? t('Saving…') : t('Download')}
        </button>
      ) : null}
    </div>
  )
}
