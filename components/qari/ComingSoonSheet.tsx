'use client'

import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { useCloseOnBack } from '@/lib/native-back'

/**
 * A short note about something on its way (the playlist, the verification badge): its picture,
 * a "Coming soon" tag, a title and a line or two. Only a message: closed by its X, a tap outside
 * it, or the phone's back button.
 */
export default function ComingSoonSheet({
  open,
  icon,
  title,
  body,
  onClose,
}: {
  open: boolean
  icon: ReactNode
  title: string
  body: string
  onClose: () => void
}) {
  const t = useT()
  useCloseOnBack(open, onClose)
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/55 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="qari-soon-title"
      onClick={onClose}
    >
      <div
        className="qari-enter relative w-full max-w-md rounded-t-[1.75rem] border border-[var(--home-card-border)] bg-[var(--home-card-bg)] px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-8 text-center shadow-[var(--home-card-shadow)] sm:rounded-[1.75rem]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* The handle a bottom sheet carries on phones. */}
        <span className="absolute left-1/2 top-2.5 h-1 w-9 -translate-x-1/2 rounded-full bg-[var(--home-rule-strong)] sm:hidden" aria-hidden />
        <button
          type="button"
          onClick={onClose}
          aria-label={t('Close')}
          className="ed-focus absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-[var(--home-muted)] transition-colors hover:bg-[var(--app-surface)]"
        >
          <X className="h-4 w-4" strokeWidth={2} />
        </button>

        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--qari-verified,#1d9bf0)_12%,transparent)]">
          {icon}
        </span>
        <span className="mt-4 inline-flex rounded-full bg-[color-mix(in_srgb,var(--qari-verified,#1d9bf0)_14%,transparent)] px-2.5 py-0.5 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-[var(--qari-verified,#1d9bf0)]">
          {t('Coming soon')}
        </span>
        <h2 id="qari-soon-title" className="home-serif mt-2.5 text-[1.375rem] font-semibold tracking-[-0.01em] text-[var(--home-heading)]">
          {title}
        </h2>
        <p className="mx-auto mt-2 max-w-[32ch] text-[14px] leading-relaxed text-[var(--home-muted)]">{body}</p>
      </div>
    </div>
  )
}
