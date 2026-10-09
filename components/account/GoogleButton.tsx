'use client'

import { useEffect, useRef, useState } from 'react'

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() || ''
const SCRIPT_SRC = 'https://accounts.google.com/gsi/client'

interface GoogleIdApi {
  initialize: (config: {
    client_id: string
    callback: (response: { credential?: string }) => void
    ux_mode?: 'popup' | 'redirect'
    use_fedcm_for_prompt?: boolean
  }) => void
  renderButton: (
    parent: HTMLElement,
    options: {
      type?: 'standard'
      theme?: 'outline' | 'filled_blue' | 'filled_black'
      size?: 'large' | 'medium'
      text?: 'continue_with' | 'signin_with' | 'signup_with'
      shape?: 'pill' | 'rectangular'
      width?: number
      logo_alignment?: 'left' | 'center'
    }
  ) => void
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleIdApi } }
  }
}

let scriptPromise: Promise<GoogleIdApi | null> | null = null

/** Google's sign-in library, loaded once and only when a button is shown. */
function loadGoogle(): Promise<GoogleIdApi | null> {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id)
  scriptPromise ??= new Promise((resolve) => {
    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.onload = () => resolve(window.google?.accounts?.id ?? null)
    script.onerror = () => {
      scriptPromise = null
      resolve(null)
    }
    document.head.appendChild(script)
  })
  return scriptPromise
}

/** Whether "Continue with Google" is set up (NEXT_PUBLIC_GOOGLE_CLIENT_ID). */
export const googleSignInAvailable = Boolean(CLIENT_ID)

/**
 * Google's own "Continue with Google" button. Tapping it shows the person's
 * Google accounts; the one they pick comes back as a signed token, which the
 * server checks with Google before trusting it (lib/google-auth.ts).
 * Renders nothing until a client id is configured.
 */
export default function GoogleButton({
  onCredential,
  text = 'continue_with',
  disabled = false,
}: {
  onCredential: (credential: string) => void
  text?: 'continue_with' | 'signin_with'
  disabled?: boolean
}) {
  const holder = useRef<HTMLDivElement | null>(null)
  const latest = useRef(onCredential)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    latest.current = onCredential
  }, [onCredential])

  useEffect(() => {
    if (!CLIENT_ID) return
    let cancelled = false
    void loadGoogle().then((api) => {
      const el = holder.current
      if (cancelled || !el) return
      if (!api) {
        setFailed(true)
        return
      }
      api.initialize({
        client_id: CLIENT_ID,
        callback: (response) => {
          if (response.credential) latest.current(response.credential)
        },
        ux_mode: 'popup',
        use_fedcm_for_prompt: true,
      })
      el.replaceChildren()
      api.renderButton(el, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text,
        shape: 'pill',
        logo_alignment: 'center',
        width: Math.min(400, Math.max(200, Math.round(el.getBoundingClientRect().width) || 320)),
      })
    })
    return () => {
      cancelled = true
    }
  }, [text])

  if (!CLIENT_ID || failed) return null
  return (
    <div
      ref={holder}
      className="flex min-h-[44px] w-full justify-center"
      style={disabled ? { opacity: 0.5, pointerEvents: 'none' } : undefined}
    />
  )
}
