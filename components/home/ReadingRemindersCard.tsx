'use client'

import { useEffect, useState } from 'react'
import { BellRing } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { hasReadBefore, reminderChoice, remindersSupported, setReminders } from '@/lib/reading-reminders'

/**
 * Asked once, on Home, in the Play Store app: whether to be reminded to read
 * after a few days away. Only someone who has read here is asked, and either
 * answer puts it away for good (Settings can change it later).
 */
export default function ReadingRemindersCard() {
  const t = useT()
  const [show, setShow] = useState(false)

  useEffect(() => {
    setShow(remindersSupported() && reminderChoice() === null && hasReadBefore())
  }, [])

  if (!show) return null

  const answer = (on: boolean) => {
    setShow(false)
    void setReminders(on)
  }

  return (
    <div className="home-card mt-3 rounded-2xl px-4 py-3.5">
      <div className="flex items-start gap-3">
        <span className="set-row__icon mt-0.5" aria-hidden>
          <BellRing className="h-[17px] w-[17px]" strokeWidth={1.9} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[0.9375rem] font-semibold text-[var(--home-heading)]">{t('Reading reminders')}</span>
          <span className="mt-0.5 block text-[0.8125rem] leading-snug text-[var(--home-muted)]">
            {t('If a few days pass without reading, Naba reminds you. Never every day.')}
          </span>
        </span>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => answer(false)}
          className="ed-focus h-9 rounded-full px-4 text-[0.8125rem] font-semibold text-[var(--home-muted)] hover:bg-[var(--home-track)]"
        >
          {t('Not now')}
        </button>
        <button type="button" onClick={() => answer(true)} className="ed-ink ed-focus h-9 rounded-full px-4 text-[0.8125rem] font-semibold">
          {t('Turn on')}
        </button>
      </div>
    </div>
  )
}
