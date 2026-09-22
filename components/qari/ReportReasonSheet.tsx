'use client'

import { AlertTriangle, Ban, Copyright, MicOff, MoreHorizontal } from 'lucide-react'
import SettingsSheet from '@/components/settings/SettingsSheet'
import { tapFeedback } from '@/lib/haptics'
import { useT } from '@/lib/i18n'

/** The canonical English text stored on the report — never translated, so the admin panel reads consistently regardless of who filed it. */
export const REPORT_REASONS = [
  { id: 'wrong', label: 'Wrong recitation', Icon: MicOff },
  { id: 'inappropriate', label: 'Inappropriate content', Icon: Ban },
  { id: 'spam', label: 'Spam', Icon: AlertTriangle },
  { id: 'copyright', label: 'Copyrighted audio', Icon: Copyright },
  { id: 'other', label: 'Other', Icon: MoreHorizontal },
] as const

interface ReportReasonSheetProps {
  open: boolean
  onClose: () => void
  onPick: (reason: (typeof REPORT_REASONS)[number]['label']) => void
}

/** What's actually wrong with it — picked, not typed, so the admin Reports panel can sort and triage instead of just reading prose. */
export default function ReportReasonSheet({ open, onClose, onPick }: ReportReasonSheetProps) {
  const t = useT()
  return (
    <SettingsSheet open={open} title={t('Report this recitation')} description={t('What is wrong with it?')} onClose={onClose}>
      <div className="divide-y divide-[var(--home-rule)] overflow-hidden rounded-2xl border border-[var(--home-rule)]" role="radiogroup">
        {REPORT_REASONS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              tapFeedback()
              onPick(label)
            }}
            className="set-row"
          >
            <span className="set-row__icon set-row__icon--neutral" aria-hidden>
              <Icon className="h-[17px] w-[17px]" strokeWidth={1.9} />
            </span>
            <span className="set-row__label">{t(label)}</span>
          </button>
        ))}
      </div>
    </SettingsSheet>
  )
}
