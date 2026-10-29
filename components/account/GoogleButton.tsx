'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import { tr, useT } from '@/lib/i18n'
import { hasNativePlugin, nativePlugin } from '@/lib/native-app'

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() || ''
const SCRIPT_SRC = 'https://accounts.google.com/gsi/client'

interface TokenResponse {
  access_token?: string
  error?: string
}

interface TokenClient {
  requestAccessToken: (overrides?: { prompt?: string }) => void
}

interface GoogleOAuthApi {
  initTokenClient: (config: {
    client_id: string
    scope: string
    callback: (response: TokenResponse) => void
    error_callback?: (error: { type?: string }) => void
  }) => TokenClient
}

declare global {
  interface Window {
    google?: { accounts?: { oauth2?: GoogleOAuthApi } }
  }
}

interface NabaGoogle {
  signIn: (options: { clientId: string }) => Promise<{ idToken: string }>
}

/**
 * Whether this is the Play Store app with its own Google sign-in
 * (android/…/NabaGooglePlugin.java): Google refuses its web sign-in inside an
 * app, so there the phone's own account picker is used.
 */
const nativeGoogle = () => hasNativePlugin('NabaGoogle')

let scriptPromise: Promise<GoogleOAuthApi | null> | null = null

/** Google's sign-in library, loaded once, ahead of the tap: the popup must open inside the tap itself. */
function loadGoogle(): Promise<GoogleOAuthApi | null> {
  if (window.google?.accounts?.oauth2) return Promise.resolve(window.google.accounts.oauth2)
  scriptPromise ??= new Promise((resolve) => {
    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.onload = () => resolve(window.google?.accounts?.oauth2 ?? null)
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
 * "Continue with Google", drawn to match the form around it. A tap opens
 * Google's own account picker (the phone's, in the Play Store app); the token
 * it hands back is checked with Google by the server (lib/google-auth.ts)
 * before anything is trusted.
 */
export default function GoogleButton({
  onCredential,
  onError,
  text = 'continue_with',
  disabled = false,
  className,
}: {
  onCredential: (credential: string) => void
  /** Said when Google could not be used: not set up yet, the popup closed, or the network. */
  onError?: (message: string) => void
  text?: 'continue_with' | 'signin_with'
  disabled?: boolean
  className?: string
}) {
  const t = useT()
  const client = useRef<TokenClient | null>(null)
  const latest = useRef({ onCredential, onError })
  const [waiting, setWaiting] = useState(false)

  useEffect(() => {
    latest.current = { onCredential, onError }
  }, [onCredential, onError])

  useEffect(() => {
    if (!CLIENT_ID || nativeGoogle()) return
    let cancelled = false
    void loadGoogle().then((api) => {
      if (cancelled || !api) return
      client.current = api.initTokenClient({
        client_id: CLIENT_ID,
        scope: 'openid email profile',
        callback: (response) => {
          setWaiting(false)
          if (response.access_token) latest.current.onCredential(response.access_token)
          else latest.current.onError?.(tr('Google sign-in did not go through. Please try again.'))
        },
        // Closing the account picker is a choice, not an error worth a message.
        error_callback: () => setWaiting(false),
      })
    })
    return () => {
      cancelled = true
    }
  }, [])

  const start = () => {
    if (!CLIENT_ID) {
      onError?.(tr("Google sign-in isn't set up yet."))
      return
    }
    if (nativeGoogle()) {
      setWaiting(true)
      void nativePlugin<NabaGoogle>('NabaGoogle')
        .then(({ plugin }) => plugin.signIn({ clientId: CLIENT_ID }))
        .then(({ idToken }) => latest.current.onCredential(idToken))
        .catch((error: { code?: string }) => {
          if (error?.code !== 'cancelled') latest.current.onError?.(tr('Google sign-in did not go through. Please try again.'))
        })
        .finally(() => setWaiting(false))
      return
    }
    if (!client.current) {
      onError?.(tr('Could not reach Google. Check your connection and try again.'))
      return
    }
    setWaiting(true)
    client.current.requestAccessToken({ prompt: 'select_account' })
  }

  return (
    <button
      type="button"
      onClick={start}
      disabled={disabled || waiting}
      className={cn('auth-google ed-focus', className)}
    >
      {waiting ? <Loader2 className="h-5 w-5 animate-spin" /> : <GoogleMark />}
      <span>{text === 'signin_with' ? t('Sign in with Google') : t('Continue with Google')}</span>
    </button>
  )
}

/** Google's four-colour "G", as its brand guidelines ask for on a sign-in button. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5 shrink-0" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}
