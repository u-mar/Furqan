'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowRight, AtSign, Check, CircleAlert, Eye, EyeOff, Loader2, ShieldCheck, UserRound, X } from 'lucide-react'
import AppMark from '@/components/account/AppMark'
import GoogleButton, { googleSignInAvailable } from '@/components/account/GoogleButton'
import { APP_NAME } from '@/lib/app-brand'
import { loginLocalUser, setSignedInUser, signupLocalUser, type AppUser } from '@/lib/auth'
import { cn } from '@/lib/cn'
import { tr, useT } from '@/lib/i18n'

type Mode = 'signup' | 'login'

const USERNAME_RULE = /^[a-z0-9_]{3,20}$/

interface AuthFlowProps {
  /** Which tab to open on. `welcome` and `signup` open on Create account. */
  start?: 'welcome' | 'signup' | 'login'
  onDone: () => void
  /** Offered when the app works without an account. */
  onSkip?: () => void
  onClose?: () => void
  /** Shown under the name in place of the tagline, e.g. "Create a free account to follow qaris." */
  reason?: string
}

/**
 * Creating an account and signing in, on one screen.
 *
 * "Continue with Google" comes first: one tap, nothing to remember, and Google
 * handles a forgotten password. Under it, a username and a 4-digit PIN for
 * anyone who would rather not use Google — Create account and Sign in are two
 * tabs of the same short form, so nobody is walked through screen after screen.
 * The username is checked while it is typed, and the PIN can be shown to catch
 * a slip, instead of asking for it twice.
 */
export default function AuthFlow({ start = 'welcome', onDone, onSkip, onClose, reason }: AuthFlowProps) {
  const t = useT()
  const [mode, setMode] = useState<Mode>(start === 'login' ? 'login' : 'signup')
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [pin, setPin] = useState('')
  const [showPin, setShowPin] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [shake, setShake] = useState(0)
  /** A new Google sign-in, waiting for the handle its recitations will go under. */
  const [google, setGoogle] = useState<{ credential: string } | null>(null)

  const fail = useCallback((message: string) => {
    setError(message)
    setShake((n) => n + 1)
  }, [])

  const finish = useCallback(
    (user: AppUser) => {
      setSignedInUser(user)
      onDone()
    },
    [onDone]
  )

  const switchMode = (next: Mode) => {
    setMode(next)
    setError('')
    setPin('')
  }

  /* --- username + PIN --- */

  const availability = useUsernameAvailability(mode === 'signup' || google ? username : '')
  const nameOk = name.trim().length >= 2
  const usernameOk = USERNAME_RULE.test(username)
  const pinOk = /^\d{4}$/.test(pin)
  const canSubmit = google
    ? nameOk && usernameOk && availability !== 'taken'
    : mode === 'signup'
      ? nameOk && usernameOk && pinOk && availability !== 'taken'
      : usernameOk && pinOk

  const submitPin = useCallback(async () => {
    setBusy(true)
    setError('')
    const cleanUsername = username.trim().toLowerCase()
    const useLocal = () =>
      finish(
        mode === 'signup' ? signupLocalUser(cleanUsername, name.trim(), pin) : loginLocalUser(cleanUsername, pin)
      )
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: mode, username: cleanUsername, name: name.trim(), pin }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string; user?: AppUser }
      if (res.ok && data.user) {
        finish(data.user)
        return
      }
      // No database configured: the app still works, on this device only.
      if ((data.error || '').toLowerCase().includes('database is not configured')) {
        useLocal()
        return
      }
      if (mode === 'login') setPin('')
      fail(data.error ? tr(data.error) : tr('Something went wrong. Please try again.'))
    } catch {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        try {
          useLocal()
          return
        } catch (err) {
          fail(err instanceof Error ? err.message : tr('Could not continue.'))
          return
        }
      }
      fail(tr('Could not reach the server. Check your connection.'))
    } finally {
      setBusy(false)
    }
  }, [fail, finish, mode, name, pin, username])

  /* --- Google --- */

  const sendGoogle = useCallback(
    async (credential: string, chosen?: { username: string; name: string }) => {
      setBusy(true)
      setError('')
      try {
        const res = await fetch('/api/auth/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ credential, ...chosen }),
        })
        const data = (await res.json().catch(() => ({}))) as {
          error?: string
          user?: AppUser
          needsUsername?: boolean
          suggestion?: string
          name?: string
        }
        if (res.ok && data.user) {
          finish(data.user)
          return
        }
        if (res.ok && data.needsUsername) {
          // New here: one more line to fill in, on this same screen.
          setGoogle({ credential })
          setName(data.name ?? '')
          setUsername(data.suggestion ?? '')
          return
        }
        fail(data.error ? tr(data.error) : tr('Something went wrong. Please try again.'))
      } catch {
        fail(tr('Could not reach the server. Check your connection.'))
      } finally {
        setBusy(false)
      }
    },
    [fail, finish]
  )

  const submit = () => {
    if (!canSubmit || busy) return
    if (google) void sendGoogle(google.credential, { username: username.trim().toLowerCase(), name: name.trim() })
    else void submitPin()
  }

  const askingName = mode === 'signup' || Boolean(google)
  const title = google ? t('Almost done') : mode === 'signup' ? t('Create your account') : t('Welcome back')
  // Why an account is wanted reads as an invitation, so it goes with Create account only.
  const subtitle = google
    ? t('Pick the username your recitations will go under.')
    : mode === 'signup'
      ? (reason ?? t('Post recitations, follow qaris and keep what you love in one place.'))
      : t('Sign in to pick up where you left off.')
  // Google can make a new account too, so its terms line stays while it is offered.
  const showTerms = mode === 'signup' || Boolean(google) || googleSignInAvailable

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto overscroll-contain">
      {/* The brand's deep green, a soft light behind the mark, and what this screen is for. */}
      <div className="auth-hero">
        {onClose ? (
          <button type="button" onClick={onClose} aria-label={t('Close')} className="auth-hero__close ed-focus">
            <X className="h-[18px] w-[18px]" strokeWidth={2} />
          </button>
        ) : null}
        <div className="auth-hero__text">
          <div className="flex items-center gap-2.5">
            <AppMark size="sm" className="auth-hero__mark" />
            <span className="home-serif text-[1.15rem] font-semibold tracking-[-0.01em] text-white">{APP_NAME}</span>
          </div>
          <h1
            key={title}
            className="auth-step home-serif mt-5 text-[1.95rem] font-semibold leading-[1.1] tracking-[-0.02em] text-white"
          >
            {title}
          </h1>
          <p className="mt-2 max-w-[21rem] text-[0.92rem] leading-snug text-white/70">{subtitle}</p>
        </div>
      </div>

      <form
        className="auth-panel"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        {!google ? (
          <>
            <div className="auth-tabs" role="tablist" aria-label={t('Account')}>
              {(['signup', 'login'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={mode === m}
                  onClick={() => switchMode(m)}
                  className={cn('auth-tab ed-focus', mode === m && 'is-on')}
                >
                  {m === 'signup' ? t('Create account') : t('Sign in')}
                </button>
              ))}
            </div>

            {googleSignInAvailable ? (
              <>
                <div className="mt-5">
                  <GoogleButton onCredential={(c) => void sendGoogle(c)} disabled={busy} />
                </div>
                <div className="mt-5 flex items-center gap-3 text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-[var(--home-muted)]">
                  <span className="h-px flex-1 bg-[var(--home-rule)]" />
                  {t('or')}
                  <span className="h-px flex-1 bg-[var(--home-rule)]" />
                </div>
              </>
            ) : null}
          </>
        ) : null}

        <div key={google ? 'google' : mode} className="auth-step mt-5 space-y-4">
          {askingName ? (
            <Field label={t('Your name')}>
              <UserRound className="auth-field__icon" strokeWidth={1.9} />
              <input
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 40))}
                placeholder={t('Your name')}
                autoComplete="name"
                autoCapitalize="words"
                enterKeyHint="next"
                className="auth-input"
              />
              {nameOk ? <Check className="auth-field__ok" strokeWidth={2.6} /> : null}
            </Field>
          ) : null}

          <Field
            label={t('Username')}
            note={askingName ? <UsernameNote username={username} status={availability} /> : undefined}
            invalid={askingName && (availability === 'taken' || availability === 'invalid')}
          >
            <AtSign className="auth-field__icon" strokeWidth={1.9} />
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20))}
              placeholder={t('username')}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="next"
              className="auth-input"
            />
            {askingName && availability === 'checking' ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[var(--home-muted)]" />
            ) : askingName && availability === 'available' ? (
              <Check className="auth-field__ok" strokeWidth={2.6} />
            ) : null}
          </Field>

          {!google ? (
            <PinBoxes
              label={mode === 'signup' ? t('Create a 4-digit PIN') : t('PIN')}
              note={mode === 'signup' ? t("You'll use it to sign in. Pick something you'll remember.") : undefined}
              value={pin}
              onChange={(next) => {
                setPin(next)
                if (error) setError('')
              }}
              show={showPin}
              onToggleShow={() => setShowPin((v) => !v)}
              invalid={Boolean(error) && mode === 'login'}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            />
          ) : null}
        </div>

        {error ? (
          <p key={shake} className="auth-shake auth-error" role="alert">
            <CircleAlert className="h-4 w-4 shrink-0" strokeWidth={2.2} />
            {error}
          </p>
        ) : null}

        <div className="min-h-6 flex-1" />

        <div className="space-y-3 pt-5">
          <button type="submit" disabled={!canSubmit || busy} className="auth-primary ed-focus">
            {busy ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                {google ? t('Finish') : mode === 'signup' ? t('Create account') : t('Sign in')}
                <ArrowRight className="h-[18px] w-[18px]" strokeWidth={2.2} />
              </>
            )}
          </button>
          {google ? (
            <button
              type="button"
              onClick={() => {
                setGoogle(null)
                setError('')
              }}
              className="auth-quiet ed-focus"
            >
              {t('Back')}
            </button>
          ) : onSkip ? (
            <button type="button" onClick={onSkip} className="auth-quiet ed-focus">
              {t('Continue without an account')}
            </button>
          ) : null}
          {showTerms ? (
            <p className="flex items-start justify-center gap-1.5 px-2 pt-1 text-center text-[11.5px] leading-relaxed text-[var(--home-muted)]">
              <ShieldCheck className="mt-[2px] h-3.5 w-3.5 shrink-0" strokeWidth={2} />
              <span>
                {t('By creating an account you agree to our')}{' '}
                <Link href="/terms" className="font-semibold text-[var(--home-heading)] underline-offset-2 hover:underline">
                  {t('Terms of Service')}
                </Link>{' '}
                {t('and')}{' '}
                <Link href="/privacy" className="font-semibold text-[var(--home-heading)] underline-offset-2 hover:underline">
                  {t('Privacy Policy')}
                </Link>
                .
              </span>
            </p>
          ) : null}
        </div>
      </form>
    </div>
  )
}

/* ------------------------------------------------------------------------ */

function Field({
  label,
  note,
  invalid = false,
  children,
}: {
  label: string
  note?: React.ReactNode
  invalid?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="auth-label">{label}</span>
      <span className={cn('auth-field', invalid && 'is-invalid')}>{children}</span>
      {note ? <span className="auth-note">{note}</span> : null}
    </label>
  )
}

/**
 * The PIN as four boxes, filled as it is typed. One real input lies over them,
 * so the phone still brings up its number pad and password managers still see it.
 */
function PinBoxes({
  label,
  note,
  value,
  onChange,
  show,
  onToggleShow,
  invalid,
  autoComplete,
}: {
  label: string
  note?: string
  value: string
  onChange: (next: string) => void
  show: boolean
  onToggleShow: () => void
  invalid: boolean
  autoComplete: string
}) {
  const t = useT()
  const [focused, setFocused] = useState(false)
  const id = 'auth-pin'
  return (
    <div>
      <div className="auth-label">
        <label htmlFor={id}>{label}</label>
        <button type="button" onClick={onToggleShow} className="auth-label__action ed-focus">
          {show ? <EyeOff className="h-3.5 w-3.5" strokeWidth={2.2} /> : <Eye className="h-3.5 w-3.5" strokeWidth={2.2} />}
          {show ? t('Hide') : t('Show')}
        </button>
      </div>
      <div className="relative">
        <div className="grid grid-cols-4 gap-2.5" aria-hidden>
          {[0, 1, 2, 3].map((i) => {
            const digit = value[i]
            const current = focused && i === Math.min(value.length, 3)
            return (
              <span
                key={i}
                className={cn('auth-pin', digit && 'is-filled', current && 'is-current', invalid && 'is-invalid')}
              >
                {digit ? show ? digit : <span className="auth-pin__dot" /> : null}
              </span>
            )
          })}
        </div>
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          type={show ? 'text' : 'password'}
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          autoComplete={autoComplete}
          enterKeyHint="go"
          className="absolute inset-0 h-full w-full cursor-text opacity-0"
        />
      </div>
      {note ? <span className="auth-note">{note}</span> : null}
    </div>
  )
}

type Availability = 'idle' | 'invalid' | 'checking' | 'available' | 'taken' | 'unknown'

/** Whether a new username is free, checked a moment after typing stops. */
function useUsernameAvailability(value: string): Availability {
  const [status, setStatus] = useState<Availability>('idle')
  const latest = useRef(value)

  useEffect(() => {
    latest.current = value
    if (!value) {
      setStatus('idle')
      return
    }
    if (!USERNAME_RULE.test(value)) {
      setStatus('invalid')
      return
    }
    setStatus('checking')
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/auth/signup?username=${encodeURIComponent(value)}`)
        const data = (await res.json()) as { available: boolean | null }
        if (latest.current !== value) return
        setStatus(data.available === true ? 'available' : data.available === false ? 'taken' : 'unknown')
      } catch {
        if (latest.current === value) setStatus('unknown')
      }
    }, 350)
    return () => window.clearTimeout(timer)
  }, [value])

  return status
}

function UsernameNote({ username, status }: { username: string; status: Availability }) {
  const t = useT()
  if (status === 'available') {
    return (
      <span className="font-medium text-[var(--home-sage-deep)]">
        {t('@{username} is yours if you want it.', { username })}
      </span>
    )
  }
  if (status === 'taken') {
    return <span className="font-medium text-rose-500">{t('@{username} is already taken.', { username })}</span>
  }
  if (status === 'invalid') {
    return <span className="font-medium text-rose-500">{t('Use 3–20 letters, numbers or underscores.')}</span>
  }
  return <span>{t('Your profile link. It can\'t be changed later.')}</span>
}
