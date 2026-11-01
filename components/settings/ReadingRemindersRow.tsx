'use client'

import { useEffect, useState } from 'react'
import { BellRing } from 'lucide-react'
import Switch from '@/components/qari/Switch'
import { useT } from '@/lib/i18n'
import { remindersOn, remindersSupported, setReminders } from '@/lib/reading-reminders'

/**
 * "Reading reminders", in Settings: only in the Play Store app, which can
 * schedule them on the phone (lib/reading-reminders.ts). On unless turned off
 * here, wherever the phone allows Naba's notifications. Says so when the phone
 * has notifications blocked for Naba, since only its settings can undo that.
 */
export default function ReadingRemindersRow({ divider }: { divider?: boolean }) {
  const t = useT()
  const [supported, setSupported] = useState(false)
  const [on, setOn] = useState(false)
  const [blocked, setBlocked] = useState(false)

  useEffect(() => {
    if (!remindersSupported()) return
    setSupported(true)
    void remindersOn().then(setOn)
  }, [])

  if (!supported) return null

  const change = async (next: boolean) => {
    setOn(next)
    const result = await setReminders(next)
    setOn(result)
    setBlocked(next && !result)
  }

  return (
    <>
      {divider ? <div className="set-row__divider" aria-hidden /> : null}
      <label className="set-row cursor-pointer">
        <span className="set-row__icon" aria-hidden>
          <BellRing className="h-[17px] w-[17px]" strokeWidth={1.9} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[0.9375rem] font-medium">{t('Reading reminders')}</span>
          <span className="block text-[0.78125rem] leading-snug text-[var(--home-muted)]">
            {blocked
              ? t("Notifications are off for Naba. Turn them on in your phone's settings.")
              : t('A gentle reminder after 3 days without reading, and once more after a week. Never daily.')}
          </span>
        </span>
        <Switch checked={on} onChange={(next) => void change(next)} label={t('Reading reminders')} />
      </label>
    </>
  )
}
