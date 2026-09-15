'use client'

import Radio from '@/components/settings/Radio'
import SettingsSheet from '@/components/settings/SettingsSheet'
import { getQiraat, narrationChoices, type Reciter } from '@/lib/reciters'

/** The narrations one reciter recorded, e.g. Hafs, Al-Susi and Khalaf. */
export default function NarrationSheet({
  open,
  reciter,
  onClose,
  onSelect,
}: {
  open: boolean
  reciter: Reciter
  onClose: () => void
  onSelect: (reciterId: string) => void
}) {
  const choices = narrationChoices(reciter)
  return (
    <SettingsSheet
      open={open}
      title="Narration"
      description={`${reciter.name} recites in ${choices.length} narrations. You keep your place when you switch.`}
      onClose={onClose}
    >
      <div className="overflow-hidden rounded-2xl border border-[var(--home-rule)]" role="radiogroup" aria-label="Narration">
        {choices.map((choice, i) => {
          const qiraat = getQiraat(choice.qiraat)
          const on = choice.qiraat === reciter.qiraat
          return (
            <div key={choice.id}>
              {i ? <div className="set-row__divider" style={{ marginLeft: 14 }} aria-hidden /> : null}
              <button
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => {
                  if (!on) onSelect(choice.id)
                  onClose()
                }}
                className="set-row"
                style={{ paddingBlock: 9 }}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.9375rem] font-medium">{qiraat.short}</span>
                  <span className="mt-px block text-[0.78125rem] text-[var(--home-muted)]">{qiraat.label}</span>
                </span>
                <Radio on={on} />
              </button>
            </div>
          )
        })}
      </div>
    </SettingsSheet>
  )
}
