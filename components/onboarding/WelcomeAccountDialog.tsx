'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import AccountForm from '@/components/account/AccountForm'
import AppMark from '@/components/account/AppMark'
import { APP_NAME } from '@/lib/app-brand'
import { dismissWelcomeAccount, shouldShowWelcomeAccount } from '@/lib/onboarding'

export default function WelcomeAccountDialog() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (shouldShowWelcomeAccount()) setVisible(true)
    }, 2800)
    return () => window.clearTimeout(timer)
  }, [])

  function skip() {
    dismissWelcomeAccount()
    setVisible(false)
  }

  function onSuccess() {
    dismissWelcomeAccount()
    setVisible(false)
    window.dispatchEvent(new CustomEvent('auth-user-changed'))
  }

  if (!visible) return null

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/45 p-4 backdrop-blur-sm pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-account-title"
    >
      <div className="relative w-full max-w-[22rem] rounded-3xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] px-5 pb-6 pt-5 shadow-[var(--home-card-shadow)] sm:max-w-sm sm:px-6 sm:pb-7 sm:pt-6">
        <button
          type="button"
          onClick={skip}
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-[var(--home-muted)] transition-colors hover:bg-[var(--app-surface)]"
          aria-label="Close"
        >
          <X className="h-5 w-5" strokeWidth={1.75} />
        </button>

        <div className="mb-6 flex flex-col items-center pt-2 text-center">
          <AppMark className="mb-4" />
          <h2
            id="welcome-account-title"
            className="home-serif text-[1.65rem] font-semibold leading-snug text-[var(--home-heading)]"
          >
            Save your progress
          </h2>
          <p className="mt-2 max-w-[16rem] text-sm leading-relaxed text-[var(--home-muted)]">
            A username and PIN on this device. Optional — you can add it later in Settings.
          </p>
        </div>

        <AccountForm initialMode="signup" onSuccess={onSuccess} compact />

        <button
          type="button"
          onClick={skip}
          className="mt-5 w-full py-1 text-center text-sm text-[var(--home-muted)] transition-colors hover:text-[var(--home-heading)]"
        >
          Not now
        </button>
      </div>
    </div>
  )
}
