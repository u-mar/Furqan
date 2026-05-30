'use client'

import { X } from 'lucide-react'
import AccountForm from '@/components/account/AccountForm'

interface AccountSheetProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function AccountSheet({ open, onClose, onSuccess }: AccountSheetProps) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 px-4 pb-4 pt-10 backdrop-blur-[2px] sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-sheet-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-3xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-[var(--home-card-border)] bg-[var(--home-sage-soft)]/40 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2
                id="account-sheet-title"
                className="home-serif text-xl font-semibold text-[var(--home-heading)]"
              >
                Your account
              </h2>
              <p className="mt-0.5 text-xs text-[var(--home-muted)]">
                Username and 4-digit PIN — works offline on this device
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--home-muted)] transition-colors hover:bg-[var(--app-surface)]"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="p-5">
          <AccountForm
            onSuccess={() => {
              onSuccess()
              onClose()
            }}
          />
        </div>
      </div>
    </div>
  )
}
