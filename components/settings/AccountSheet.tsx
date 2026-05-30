'use client'

import { X } from 'lucide-react'
import AccountForm from '@/components/account/AccountForm'
import AppMark from '@/components/account/AppMark'

interface AccountSheetProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function AccountSheet({ open, onClose, onSuccess }: AccountSheetProps) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 px-4 pb-4 pt-12 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-sheet-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[22rem] rounded-3xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] px-5 pb-6 pt-5 shadow-[var(--home-card-shadow)] sm:max-w-sm sm:px-6 sm:pb-7 sm:pt-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start gap-3">
          <AppMark size="sm" className="mt-0.5" />
          <div className="min-w-0 flex-1 pr-8">
            <h2
              id="account-sheet-title"
              className="home-serif text-xl font-semibold text-[var(--home-heading)]"
            >
              Account
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-[var(--home-muted)]">
              Stored on this device. Works without Wi‑Fi.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-[var(--home-muted)] transition-colors hover:bg-[var(--app-surface)]"
            aria-label="Close"
          >
            <X className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>

        <AccountForm
          onSuccess={() => {
            onSuccess()
            onClose()
          }}
        />
      </div>
    </div>
  )
}
