'use client'

import { useEffect, useState } from 'react'
import AuthFlow from '@/components/account/AuthFlow'
import { dismissWelcomeAccount, shouldShowWelcomeAccount } from '@/lib/onboarding'

/**
 * First launch. Shown straight away rather than after a delay: arriving over
 * an app that has already appeared reads as an interruption, while arriving
 * first reads as the start of the app.
 *
 * Always skippable — reading the Quran needs no account, and both app stores
 * reject apps that demand one for features that do not.
 */
export default function WelcomeAccountDialog() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (shouldShowWelcomeAccount()) setVisible(true)
  }, [])

  useEffect(() => {
    if (!visible) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [visible])

  if (!visible) return null

  const close = () => {
    dismissWelcomeAccount()
    setVisible(false)
  }

  return (
    <div className="auth-screen" role="dialog" aria-modal="true" aria-label="Welcome">
      <div className="auth-screen__body">
        <AuthFlow
          start="welcome"
          onSkip={close}
          onDone={() => {
            window.dispatchEvent(new CustomEvent('auth-user-changed'))
            close()
          }}
        />
      </div>
    </div>
  )
}
