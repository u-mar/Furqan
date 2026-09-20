'use client'

import { useEffect } from 'react'
import AuthFlow from '@/components/account/AuthFlow'
import { useT } from '@/lib/i18n'

interface AccountSheetProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  /** Why an account is needed right now, when something asked for one. */
  reason?: string
}

/**
 * Sign in or create an account from anywhere in the app — the same flow the
 * first launch uses, minus the option to skip, since opening it was a choice.
 */
export default function AccountSheet({ open, onClose, onSuccess, reason }: AccountSheetProps) {
  const t = useT()
  // The page underneath should not scroll while this covers it.
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  if (!open) return null

  return (
    <div className="auth-screen" role="dialog" aria-modal="true" aria-label={t('Account')}>
      <div className="auth-screen__body">
        <AuthFlow
          start="welcome"
          reason={reason}
          onClose={onClose}
          onDone={() => {
            window.dispatchEvent(new CustomEvent('auth-user-changed'))
            onSuccess()
            onClose()
          }}
        />
      </div>
    </div>
  )
}
