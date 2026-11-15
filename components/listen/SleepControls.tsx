'use client'

import { useEffect, useRef } from 'react'
import { Moon } from 'lucide-react'
import SettingsSheet from '@/components/settings/SettingsSheet'
import { useListenProgress, useListenState } from '@/hooks/useListen'
import { useNow } from '@/hooks/useNow'
import { tapFeedback } from '@/lib/haptics'
import {
  SLEEP_CHOICES,
  endSleep,
  formatMinutesLeft,
  sleepChoiceLabel,
  sleepMsLeft,
  startSleep,
  type SleepChoice,
} from '@/lib/listen-player'
import { toast, toastSuccess } from '@/lib/toast'
import { tr, useT } from '@/lib/i18n'

export function turnOnSleep(choice: SleepChoice) {
  startSleep(choice)
  toastSuccess(
    choice === 'surah'
      ? tr('Sleep mode on · stops at the end of this surah')
      : tr('Sleep mode on · stops in {min}', { min: choice === 60 ? '1 hour' : `${choice} min` })
  )
}

export function turnOffSleep() {
  endSleep()
  toast(tr('Sleep mode off'))
}

/** "28 min" until sleep mode stops the recitation, kept current. */
export function SleepLeft({ prefix = '', fallback = '' }: { prefix?: string; fallback?: string }) {
  const { sleep } = useListenState()
  const progress = useListenProgress()
  const now = useNow(1000, Boolean(sleep))
  if (!sleep) return null
  const left = sleepMsLeft(sleep, now, progress)
  return <>{left === null ? fallback : `${prefix}${formatMinutesLeft(left)}`}</>
}

/** Switch sleep mode on or off, and choose when it stops. */
export function SleepSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT()
  const { sleep, surah } = useListenState()
  const closing = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(closing.current), [])

  const choose = (choice: SleepChoice) => {
    tapFeedback()
    turnOnSleep(choice)
    // Long enough to see the choice land before the sheet goes.
    window.clearTimeout(closing.current)
    closing.current = window.setTimeout(onClose, 320)
  }

  const minutes = SLEEP_CHOICES.filter((choice): choice is Exclude<SleepChoice, 'surah'> => choice !== 'surah')

  return (
    <SettingsSheet open={open} title={t('Sleep mode')} description={t('Fall asleep to the Quran. It stops by itself.')} onClose={onClose}>
      <div className="nature-accent">
        {/* What it is doing now: the time left, large, with the way to turn it off beside it. */}
        <div className="sleep-status" data-on={sleep ? 'true' : 'false'}>
          <span className="sleep-status__moon" aria-hidden>
            <Moon className="h-6 w-6" strokeWidth={1.8} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[1.375rem] font-semibold leading-tight tabular-nums text-[var(--home-heading)]">
              {sleep ? <SleepLeft fallback={t('End of this surah')} /> : t('Off')}
            </span>
            <span className="mt-0.5 block text-[0.8125rem] text-[var(--home-muted)]">
              {sleep ? t('until the recitation stops') : t('Choose when it stops')}
            </span>
          </span>
          {sleep ? (
            <button
              type="button"
              onClick={() => {
                tapFeedback()
                turnOffSleep()
              }}
              className="fx-press ed-focus h-10 shrink-0 rounded-full bg-[color-mix(in_srgb,var(--home-heading)_10%,transparent)] px-4 text-[0.875rem] font-semibold text-[var(--home-heading)]"
            >
              {t('Turn off')}
            </button>
          ) : null}
        </div>

        <div className="mt-3 grid grid-cols-4 gap-2" role="radiogroup" aria-label={t('Stop after')}>
          {minutes.map((choice) => (
            <button
              key={choice}
              type="button"
              role="radio"
              aria-checked={sleep?.choice === choice}
              aria-label={sleepChoiceLabel(choice)}
              onClick={() => choose(choice)}
              className="sleep-chip ed-focus"
            >
              <span className="text-[1.5rem] font-semibold leading-none tabular-nums">{choice}</span>
              <span className="mt-1 text-[0.75rem] font-medium opacity-70">{t('min')}</span>
            </button>
          ))}
          <button
            type="button"
            role="radio"
            aria-checked={sleep?.choice === 'surah'}
            disabled={!surah}
            onClick={() => choose('surah')}
            className="sleep-chip sleep-chip--wide ed-focus col-span-4"
          >
            <span className="text-[0.9375rem] font-semibold">{sleepChoiceLabel('surah')}</span>
          </button>
        </div>
        <p className="mx-1 mt-3 text-[0.78125rem] leading-relaxed text-[var(--home-muted)]">
          {t('When a surah ends, the next one plays until the time is up. Then sleep mode turns itself off.')}
        </p>
      </div>
    </SettingsSheet>
  )
}
