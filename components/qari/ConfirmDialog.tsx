'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useT } from '@/lib/i18n'
import { useCloseOnBack } from '@/lib/native-back'
import { lockPageScroll } from '@/lib/scroll-lock'

/**
 * A question that needs a yes before something is lost: a title, a line on what happens, and the two
 * answers. Back, a tap outside or Cancel keeps things as they are.
 */
export default function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  body?: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}) {
  const t = useT()
  useCloseOnBack(open, onCancel)
  useEffect(() => (open ? lockPageScroll() : undefined), [open])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 px-8 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby={body ? 'confirm-body' : undefined}
        className="qari-enter w-full max-w-[20rem] overflow-hidden rounded-[1.375rem] bg-[var(--home-card-bg)] text-center shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pb-4 pt-5">
          <h2 id="confirm-title" className="text-[1.0625rem] font-semibold text-[var(--home-heading)]">
            {title}
          </h2>
          {body ? (
            <p id="confirm-body" className="mt-1.5 text-[0.875rem] leading-snug text-[var(--home-muted)]">
              {body}
            </p>
          ) : null}
        </div>
        <div className="grid grid-cols-2 border-t border-[var(--home-rule)]">
          <button
            type="button"
            onClick={onCancel}
            className="ed-focus h-12 border-r border-[var(--home-rule)] text-[0.9375rem] font-medium text-[var(--home-heading)]"
          >
            {t('Cancel')}
          </button>
          <button type="button" onClick={onConfirm} className="ed-focus h-12 text-[0.9375rem] font-semibold text-rose-500" autoFocus>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
