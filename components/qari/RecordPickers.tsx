'use client'

import Radio from '@/components/settings/Radio'
import SettingsSheet from '@/components/settings/SettingsSheet'
import { SheikhMonogram } from '@/components/qari/SheikhCards'
import { tapFeedback } from '@/lib/haptics'
import { SPACES, type SpaceId } from '@/lib/audio-space'
import { SHEIKHS } from '@/lib/sheikhs'
import { useT } from '@/lib/i18n'

/** The room a recitation is heard in, chosen from a list with what each sounds like. */
export function SoundSheet({
  open,
  value,
  onClose,
  onSelect,
}: {
  open: boolean
  value: SpaceId
  onClose: () => void
  onSelect: (id: SpaceId) => void
}) {
  const t = useT()
  return (
    <SettingsSheet open={open} title={t('Sound')} description={t('How the room around your voice sounds. You can change it after recording too.')} onClose={onClose}>
      <div className="overflow-hidden rounded-2xl border border-[var(--home-rule)]" role="radiogroup" aria-label={t('Sound')}>
        {SPACES.map((space, i) => {
          const on = space.id === value
          return (
            <div key={space.id}>
              {i ? <div className="set-row__divider" style={{ marginLeft: 14 }} aria-hidden /> : null}
              <button
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => {
                  tapFeedback()
                  onSelect(space.id)
                  onClose()
                }}
                className="set-row"
                style={{ paddingBlock: 9 }}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.9375rem] font-medium">{t(space.label)}</span>
                  <span className="mt-px block text-[0.78125rem] text-[var(--home-muted)]">{t(space.hint)}</span>
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

/** Whose recitation you are imitating, with the same portraits Listen shows. */
export function SheikhSheet({
  open,
  value,
  onClose,
  onSelect,
}: {
  open: boolean
  value: string
  onClose: () => void
  onSelect: (id: string) => void
}) {
  const t = useT()
  return (
    <SettingsSheet open={open} title={t('Sheikh')} description={t('Your recitation also appears on his page.')} onClose={onClose}>
      <div className="overflow-hidden rounded-2xl border border-[var(--home-rule)]" role="radiogroup" aria-label={t('Sheikh')}>
        {SHEIKHS.map((sheikh, i) => {
          const on = sheikh.id === value
          return (
            <div key={sheikh.id}>
              {i ? <div className="set-row__divider" style={{ marginLeft: 62 }} aria-hidden /> : null}
              <button
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => {
                  tapFeedback()
                  onSelect(sheikh.id)
                  onClose()
                }}
                className="set-row"
                style={{ paddingBlock: 8 }}
              >
                <SheikhMonogram sheikh={sheikh} size={38} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.9375rem] font-medium">{sheikh.shortName}</span>
                  <span className="mt-px block truncate text-[0.78125rem] text-[var(--home-muted)]">{sheikh.name}</span>
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
