'use client'

import { useEffect, useState } from 'react'
import AccountSheet from '@/components/settings/AccountSheet'
import { ACCOUNT_PROMPT_EVENT, type AccountPrompt } from '@/lib/account-prompt'
import { getSignedInUser } from '@/lib/auth'

/** Shows the sign-in sheet whenever some part of the app calls askToSignIn(). */
export default function AccountPromptHost() {
  const [prompt, setPrompt] = useState<AccountPrompt | null>(null)

  useEffect(() => {
    const onPrompt = (e: Event) => setPrompt((e as CustomEvent<AccountPrompt>).detail ?? {})
    window.addEventListener(ACCOUNT_PROMPT_EVENT, onPrompt)
    return () => window.removeEventListener(ACCOUNT_PROMPT_EVENT, onPrompt)
  }, [])

  return (
    <AccountSheet
      open={prompt !== null}
      reason={prompt?.reason}
      onSuccess={() => prompt?.onDone?.()}
      onClose={() => {
        const current = prompt
        setPrompt(null)
        if (current && !getSignedInUser()) current.onCancel?.()
      }}
    />
  )
}
