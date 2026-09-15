'use client'

import { useEffect, useRef } from 'react'
import { Moon } from 'lucide-react'
import Switch from '@/components/qari/Switch'
import Radio from '@/components/settings/Radio'
import SettingsSheet from '@/components/settings/SettingsSheet'
import { useListenProgress, useListenState } from '@/hooks/useListen'
import { useNow } from '@/hooks/useNow'
import { tapFeedback } from '@/lib/haptics'
import {
  SLEEP_CHOICES,
  endSleep,
  formatMinutesLeft,
  lastSleepChoice,
  sleepChoiceLabel,
  sleepMsLeft,
  startSleep,
  type SleepChoice,
} from '@/lib/listen-player'
import { toast, toastSuccess } from '@/lib/toast'

export function turnOnSleep(choice: SleepChoice) {
  startSleep(choice)
  toastSuccess(
    choice === 'surah'
      ? 'Sleep mode on · stops at the end of this surah'
      : `Sleep mode on · stops in ${choice === 60 ? '1 hour' : `${choice} min`}`
  )
}

export function turnOffSleep() {
  endSleep()
  toast('Sleep mode off')
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

/** The moon at the top of Listen: plain while off, the time left once on. */
export function SleepButton({ onOpen }: { onOpen: () => void }) {
  const { sleep } = useListenState()
  const open = () => {
    tapFeedback()
    onOpen()
  }

  if (!sleep) {
    return (
      <button type="button" onClick={open} className="home-round ed-focus" aria-label="Sleep mode">
        <Moon className="h-[19px] w-[19px]" strokeWidth={1.9} />
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={open}
      aria-label="Sleep mode is on"
      className="fx-pop-in fx-press ed-focus flex h-[42px] shrink-0 items-center gap-[7px] rounded-full bg-[var(--home-card-bg)] pl-3 pr-3.5 text-[0.84375rem] font-semibold tabular-nums text-[var(--home-sage-deep)] shadow-[var(--home-lift-sm)]"
    >
      <Moon className="h-4 w-4 fill-current text-[var(--home-sage)]" strokeWidth={1.9} />
      <SleepLeft fallback="On" />
    </button>
  )
}

/** Switch sleep mode on or off, and choose when it stops. */
export function SleepSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
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

  return (
    <SettingsSheet open={open} title="Sleep mode" description="Fall asleep to the Quran. It stops by itself." onClose={onClose}>
      <div className="overflow-hidden rounded-2xl border border-[var(--home-rule)]">
        <label className="set-row cursor-pointer" style={{ paddingBlock: 9 }}>
          <span className="set-row__icon" aria-hidden>
            <Moon className="h-[17px] w-[17px]" strokeWidth={1.9} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[0.9375rem] font-medium">Sleep mode</span>
            <span className="mt-px block text-[0.78125rem] tabular-nums text-[var(--home-muted)]">
              {sleep ? <SleepLeft prefix="Stops in " fallback="Stops at the end of this surah" /> : 'Off'}
            </span>
          </span>
          <Switch
            checked={Boolean(sleep)}
            onChange={(on) => (on ? turnOnSleep(lastSleepChoice()) : turnOffSleep())}
            label="Sleep mode"
          />
        </label>
      </div>

      <h3 className="home-label mx-1 mb-2 mt-[18px]">Stop after</h3>
      <div className="overflow-hidden rounded-2xl border border-[var(--home-rule)]" role="radiogroup" aria-label="Stop after">
        {SLEEP_CHOICES.map((choice, i) => (
          <div key={String(choice)}>
            {i ? <div className="set-row__divider" style={{ marginLeft: 14 }} aria-hidden /> : null}
            <button
              type="button"
              role="radio"
              aria-checked={sleep?.choice === choice}
              disabled={choice === 'surah' && !surah}
              onClick={() => choose(choice)}
              className="set-row"
            >
              <span className="set-row__label">{sleepChoiceLabel(choice)}</span>
              <Radio on={sleep?.choice === choice} />
            </button>
          </div>
        ))}
      </div>
      <p className="mx-1 mt-2.5 text-[0.78125rem] leading-relaxed text-[var(--home-muted)]">
        When a surah ends, the next one plays until the time is up. Then sleep mode turns itself off.
      </p>
    </SettingsSheet>
  )
}
