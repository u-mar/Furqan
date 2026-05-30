'use client'

import { useEffect, useState } from 'react'
import { BookOpen, Headphones, Sparkles, X } from 'lucide-react'
import AccountForm from '@/components/account/AccountForm'
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
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/55 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-account-title"
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] shadow-2xl">
        <div
          className="relative px-6 pb-5 pt-6 text-white"
          style={{ background: 'var(--home-sage-gradient)' }}
        >
          <button
            type="button"
            onClick={skip}
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/20 text-white backdrop-blur-sm transition-colors hover:bg-black/35"
            aria-label="Skip for now"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
            <Sparkles className="h-5 w-5" />
          </div>
          <h2 id="welcome-account-title" className="home-serif text-2xl font-semibold leading-tight">
            Welcome to {APP_NAME}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-white/90">
            Create a free account to save progress. You can skip and sign up later in Settings.
          </p>
          <ul className="mt-4 space-y-2 text-xs text-white/85">
            <li className="flex items-center gap-2">
              <BookOpen className="h-3.5 w-3.5 shrink-0" />
              Read & test your hifdh
            </li>
            <li className="flex items-center gap-2">
              <Headphones className="h-3.5 w-3.5 shrink-0" />
              Listen with your favourite reciter
            </li>
          </ul>
        </div>

        <div className="px-5 py-5">
          <AccountForm initialMode="signup" onSuccess={onSuccess} />
          <button
            type="button"
            onClick={skip}
            className="mt-3 w-full py-2 text-center text-sm font-medium text-[var(--home-muted)] underline-offset-2 hover:underline"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  )
}
