'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, AtSign, Check, CircleAlert, Eye, EyeOff, Loader2, Mail, MailCheck, X } from 'lucide-react'
import GoogleButton from '@/components/account/GoogleButton'
import LogoMark from '@/components/brand/LogoMark'
import { APP_NAME } from '@/lib/app-brand'
import { loginLocalUser, setSignedInUser, type AppUser } from '@/lib/auth'
import { cn } from '@/lib/cn'
import { tr, useT } from '@/lib/i18n'

type View = 'choose' | 'email' | 'signin' | 'signup' | 'profile' | 'forgot' | 'sent'

const USERNAME_RULE = /^[a-z0-9_]{3,20}$/
const EMAIL_RULE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const MIN_PASSWORD = 8

interface AuthFlowProps {
  /** Every way in opens on the same first screen: Google, or email. Kept for the callers that say which. */
  start?: 'welcome' | 'signup' | 'login'
  onDone: () => void
  /** Offered when the app works without an account. */
  onSkip?: () => void
  onClose?: () => void
  /** Shown under the welcome in place of the usual line, e.g. "Create a free account to follow qaris." */
  reason?: string
}

/**
 * Signing in or creating an account, the way apps do it: a first screen with
 * just two choices, Google or email. With email, the address comes first and
 * the server says whether it has an account: if it does, the next step asks
 * for its password; if not, one to choose, then the name and username the
 * account's recitations go under. Accounts made before emails sign in with
 * their username, their 4-digit PIN serving as the password.
 */
export default function AuthFlow({ onDone, onSkip, onClose, reason }: AuthFlowProps) {
  const t = useT()
  const [view, setView] = useState<View>('choose')
  const [identifier, setIdentifier] = useState('')
  /** Signing in with a username (older accounts) rather than the email checked a step before. */
  const [byUsername, setByUsername] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [remember, setRemember] = useState(true)
  const [agreed, setAgreed] = useState(false)
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [shake, setShake] = useState(0)
  /** A new Google sign-in, waiting for its name and username. */
  const [google, setGoogle] = useState<{ credential: string } | null>(null)

  const fail = useCallback((message: string) => {
    setError(message)
    setShake((n) => n + 1)
  }, [])

  const go = (next: View) => {
    setView(next)
    setError('')
  }

  const finish = useCallback(
    (user: AppUser) => {
      setSignedInUser(user, { remember })
      onDone()
    },
    [onDone, remember]
  )

  const post = useCallback(async (url: string, body: unknown) => {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = (await res.json().catch(() => ({}))) as {
      error?: string
      user?: AppUser
      needsUsername?: boolean
      suggestion?: string
      name?: string
    }
    return { ok: res.ok, status: res.status, data }
  }, [])

  /* --- the checks behind each button --- */

  const availability = useUsernameAvailability(view === 'profile' ? username : '')
  const emailOk = EMAIL_RULE.test(email.trim())
  const passwordOk = password.length >= MIN_PASSWORD
  const confirmOk = confirm === password
  const canSubmit =
    view === 'email'
      ? emailOk
      : view === 'signin'
        ? identifier.trim().length > 0 && password.length > 0
        : view === 'signup'
          ? passwordOk && confirmOk && agreed
          : view === 'profile'
            ? name.trim().length >= 2 && USERNAME_RULE.test(username) && availability !== 'taken'
            : view === 'forgot'
              ? emailOk
              : false

  /* --- actions --- */

  const signIn = async () => {
    const id = identifier.trim()
    try {
      const { ok, data } = await post('/api/auth/email', { action: 'login', identifier: id, password })
      if (ok && data.user) return finish(data.user)
      setPassword('')
      fail(data.error ? tr(data.error) : tr('Something went wrong. Please try again.'))
    } catch {
      // Offline: an account kept only on this phone can still sign in.
      if (!id.includes('@')) {
        try {
          return finish(loginLocalUser(id, password))
        } catch {
          /* not one of those either */
        }
      }
      fail(tr('Could not reach the server. Check your connection.'))
    }
  }

  // The email is looked up as soon as it looks complete, while it is still
  // being typed, so "Continue" usually has its answer already.
  const emailCheck = useRef<{ email: string; result: Promise<EmailCheck> } | null>(null)
  const checkEmail = useCallback((value: string): Promise<EmailCheck> => {
    if (emailCheck.current?.email === value) return emailCheck.current.result
    const result = fetch(`/api/auth/email?email=${encodeURIComponent(value)}`).then(async (res) => ({
      ok: res.ok,
      ...((await res.json().catch(() => ({}))) as Omit<EmailCheck, 'ok'>),
    }))
    // A failed lookup is not kept, so pressing the button again tries afresh.
    result.catch(() => {
      if (emailCheck.current?.result === result) emailCheck.current = null
    })
    emailCheck.current = { email: value, result }
    return result
  }, [])

  useEffect(() => {
    if (view !== 'email' || !EMAIL_RULE.test(email.trim())) return
    const timer = window.setTimeout(() => void checkEmail(email.trim()).catch(() => {}), 500)
    return () => window.clearTimeout(timer)
  }, [checkEmail, email, view])

  /** The email decides the way on: its password if it has an account, a new one if not. */
  const continueWithEmail = async () => {
    const value = email.trim()
    try {
      const data = await checkEmail(value)
      if (!data.ok) return fail(data.error ? tr(data.error) : tr('Enter a valid email address.'))
      setPassword('')
      setConfirm('')
      if (data.taken) {
        setIdentifier(value)
        setByUsername(false)
        go('signin')
        return
      }
      if (!username && data.suggestion) setUsername(data.suggestion)
      go('signup')
    } catch {
      fail(tr('Could not reach the server. Check your connection.'))
    }
  }

  const createAccount = async () => {
    const chosen = { username: username.trim().toLowerCase(), name: name.trim() }
    try {
      const { ok, data } = google
        ? await post('/api/auth/google', { credential: google.credential, ...chosen })
        : await post('/api/auth/email', { action: 'signup', email: email.trim(), password, ...chosen })
      if (ok && data.user) return finish(data.user)
      fail(data.error ? tr(data.error) : tr('Something went wrong. Please try again.'))
    } catch {
      fail(tr('Could not reach the server. Check your connection.'))
    }
  }

  const sendReset = async () => {
    try {
      const { ok, data } = await post('/api/auth/password/forgot', { email: email.trim() })
      if (ok) return go('sent')
      fail(data.error ? tr(data.error) : tr('Something went wrong. Please try again.'))
    } catch {
      fail(tr('Could not reach the server. Check your connection.'))
    }
  }

  const withGoogle = useCallback(
    async (credential: string) => {
      setBusy(true)
      setError('')
      try {
        const { ok, data } = await post('/api/auth/google', { credential })
        if (ok && data.user) return finish(data.user)
        if (ok && data.needsUsername) {
          // New here: the name and username step.
          setGoogle({ credential })
          setName(data.name ?? '')
          setUsername(data.suggestion ?? '')
          go('profile')
          return
        }
        fail(data.error ? tr(data.error) : tr('Something went wrong. Please try again.'))
      } catch {
        fail(tr('Could not reach the server. Check your connection.'))
      } finally {
        setBusy(false)
      }
    },
    [fail, finish, post]
  )

  /** What is still missing, said when the button is pressed rather than by greying it out. */
  const missing = (): string => {
    if (view === 'signin') return byUsername ? tr('Enter your username and password.') : tr('Enter your password.')
    if (view === 'email' || view === 'forgot') return emailOk ? '' : tr('Enter a valid email address.')
    if (view === 'signup') {
      if (!passwordOk) return tr('Use at least 8 characters for your password.')
      if (!confirmOk) return tr("Passwords don't match.")
      if (!agreed) return tr('Please agree to the Terms of Service and Privacy Policy.')
    }
    if (view === 'profile') {
      if (name.trim().length < 2) return tr('Please enter your name.')
      if (availability === 'taken') return tr('That username is taken.')
      return tr('Use 3–20 letters, numbers or underscores.')
    }
    return ''
  }

  const submit = async () => {
    if (busy) return
    if (!canSubmit) {
      const why = missing()
      if (why) fail(why)
      return
    }
    setBusy(true)
    setError('')
    try {
      if (view === 'email') await continueWithEmail()
      else if (view === 'signin') await signIn()
      else if (view === 'signup') go('profile')
      else if (view === 'profile') await createAccount()
      else if (view === 'forgot') await sendReset()
    } finally {
      setBusy(false)
    }
  }

  const back: (() => void) | null =
    view === 'email'
      ? () => go('choose')
      : view === 'signin'
        ? () => go(byUsername ? 'choose' : 'email')
        : view === 'signup'
          ? () => go('email')
          : view === 'profile'
            ? () => {
                const fromGoogle = google !== null
                setGoogle(null)
                go(fromGoogle ? 'choose' : 'signup')
              }
            : view === 'forgot' || view === 'sent'
              ? () => go('signin')
              : null

  const topBar = (
    <div className="flex h-11 items-center justify-between">
      {back ? (
        <button type="button" onClick={back} aria-label={t('Back')} className="auth-icon-button ed-focus -ml-2">
          <ArrowLeft className="h-5 w-5 rtl:-scale-x-100" strokeWidth={2} />
        </button>
      ) : (
        <span />
      )}
      {onClose ? (
        <button type="button" onClick={onClose} aria-label={t('Close')} className="auth-icon-button ed-focus -mr-2">
          <X className="h-5 w-5" strokeWidth={2} />
        </button>
      ) : null}
    </div>
  )

  const alert = error ? (
    <p key={shake} className="auth-shake auth-alert" role="alert">
      <CircleAlert className="h-4 w-4 shrink-0" strokeWidth={2.2} />
      <span>
        {error}
        {view === 'profile' && error === tr('An account with this email already exists. Sign in instead.') ? (
          <>
            {' '}
            <button
              type="button"
              onClick={() => {
                setIdentifier(email.trim())
                setByUsername(false)
                setPassword('')
                go('signin')
              }}
              className="font-semibold underline underline-offset-2"
            >
              {t('Sign in')}
            </button>
          </>
        ) : null}
      </span>
    </p>
  ) : null

  /* --- the first screen: Google or email --- */

  if (view === 'choose') {
    return (
      <div className="flex h-full min-h-0 flex-col overflow-y-auto overscroll-contain">
        <div className="relative flex min-h-full flex-1 flex-col px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]">
          {topBar}

          <div className="auth-step flex flex-1 flex-col items-center justify-center py-10 text-center">
            <span className="auth-mark" aria-hidden>
              <LogoMark className="h-full w-full" />
            </span>
            <h1 className="home-serif mt-6 text-[2rem] font-medium leading-tight tracking-[-0.02em] text-[var(--auth-text)]">
              {t('Welcome to {name}', { name: APP_NAME })}
            </h1>
            <p className="mt-2.5 max-w-[19rem] text-[0.95rem] leading-relaxed text-[var(--auth-muted)]">
              {reason ?? t('Save your place, follow qaris and read together.')}
            </p>
          </div>

          <div className="auth-step space-y-3">
            {alert}
            <GoogleButton onCredential={(c) => void withGoogle(c)} onError={fail} disabled={busy} />
            <button type="button" onClick={() => go('email')} disabled={busy} className="auth-button ed-focus">
              <Mail className="h-[18px] w-[18px]" strokeWidth={2} />
              {t('Continue with email')}
            </button>
            <p className="px-2 pt-2 text-center text-[0.75rem] leading-relaxed text-[var(--auth-muted)]">
              {t('By continuing you agree to our')}{' '}
              <Link href="/terms" className="font-semibold text-[var(--auth-text)] underline-offset-2 hover:underline">
                {t('Terms of Service')}
              </Link>{' '}
              {t('and')}{' '}
              <Link href="/privacy" className="font-semibold text-[var(--auth-text)] underline-offset-2 hover:underline">
                {t('Privacy Policy')}
              </Link>
              .
            </p>
            {onSkip ? (
              <button
                type="button"
                onClick={onSkip}
                className="ed-focus mx-auto block rounded py-1 text-[0.88rem] font-medium text-[var(--auth-muted)] hover:text-[var(--auth-text)]"
              >
                {t('Continue without an account')}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    )
  }

  /* --- the steps after it --- */

  const heading = {
    email: { title: t('What is your email?'), line: t("We'll check whether you already have an account.") },
    signin: byUsername
      ? { title: t('Sign in'), line: t("Welcome back, you've been missed.") }
      : { title: t('Welcome back'), line: t('Enter your password for {email}.', { email: identifier.trim() }) },
    signup: { title: t('Create your account'), line: t('Choose a password for {email}.', { email: email.trim() }) },
    profile: { title: t('Almost done'), line: t('Pick the name and username your recitations will go under.') },
    forgot: { title: t('Forgot password'), line: t("Enter your email and we'll send you a link to choose a new password.") },
    sent: { title: t('Check your email'), line: '' },
  }[view]

  const button = {
    email: t('Continue'),
    signin: t('Sign in'),
    signup: t('Continue'),
    profile: t('Create account'),
    forgot: t('Send reset link'),
    sent: '',
  }[view]

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto overscroll-contain">
      <form
        className="relative flex min-h-full flex-1 flex-col px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
        noValidate
      >
        {topBar}

        <div key={view} className="auth-step mt-6">
          {view === 'sent' ? (
            <span className="auth-badge mb-5 flex h-14 w-14 items-center justify-center rounded-2xl">
              <MailCheck className="h-7 w-7" strokeWidth={1.8} />
            </span>
          ) : null}
          <h1 className="home-serif text-[1.85rem] font-medium leading-tight tracking-[-0.02em] text-[var(--auth-text)]">
            {heading.title}
          </h1>
          {heading.line ? (
            // A long email address wraps rather than running off the screen.
            <p className="mt-1.5 text-[0.95rem] leading-snug text-[var(--auth-muted)] [overflow-wrap:anywhere]">{heading.line}</p>
          ) : null}
          {view === 'sent' ? (
            <p className="mt-2 text-[0.95rem] leading-relaxed text-[var(--auth-muted)]">
              {t('If an account uses {email}, a link to reset your password is on its way. It works for 30 minutes.', {
                email: email.trim(),
              })}
            </p>
          ) : null}

          <div className="mt-8 space-y-5">
            {view === 'email' || view === 'forgot' ? (
              <Field label={t('Email')}>
                <input
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value.slice(0, 254))
                    if (error) setError('')
                  }}
                  placeholder={t('Enter your email')}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  autoFocus
                  enterKeyHint={view === 'forgot' ? 'send' : 'next'}
                  className="auth-input2"
                />
              </Field>
            ) : null}

            {view === 'signin' ? (
              <>
                {byUsername ? (
                  <Field label={t('Username')}>
                    <AtSign className="h-4 w-4 shrink-0 text-[var(--auth-muted)]" strokeWidth={2} />
                    <input
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value.slice(0, 254))}
                      placeholder={t('username')}
                      type="text"
                      autoComplete="username"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      autoFocus
                      enterKeyHint="next"
                      className="auth-input2"
                    />
                  </Field>
                ) : null}
                <PasswordField
                  label={t('Password')}
                  placeholder={t('Enter your password')}
                  value={password}
                  onChange={(v) => {
                    setPassword(v)
                    if (error) setError('')
                  }}
                  autoComplete="current-password"
                  enterKeyHint="go"
                  autoFocus={!byUsername}
                />
                <div className="flex items-center justify-between">
                  <Checkbox checked={remember} onChange={setRemember}>
                    {t('Remember me')}
                  </Checkbox>
                  <button
                    type="button"
                    onClick={() => {
                      if (identifier.includes('@')) setEmail(identifier.trim())
                      go('forgot')
                    }}
                    className="ed-focus rounded text-[0.85rem] font-semibold text-[var(--auth-text)] underline-offset-2 hover:underline"
                  >
                    {t('Forgot password?')}
                  </button>
                </div>
              </>
            ) : null}

            {view === 'signup' ? (
              <>
                <PasswordField
                  label={t('New password')}
                  placeholder={t('At least 8 characters')}
                  value={password}
                  onChange={setPassword}
                  autoComplete="new-password"
                  enterKeyHint="next"
                  autoFocus
                  note={password && !passwordOk ? t('Use at least 8 characters for your password.') : undefined}
                />
                <PasswordField
                  label={t('Confirm password')}
                  placeholder={t('Enter the password again')}
                  value={confirm}
                  onChange={setConfirm}
                  autoComplete="new-password"
                  enterKeyHint="go"
                  invalid={Boolean(confirm) && !confirmOk}
                  note={confirm && !confirmOk ? t("Passwords don't match.") : undefined}
                  ok={Boolean(confirm) && confirmOk && passwordOk}
                />
                <Checkbox checked={agreed} onChange={setAgreed}>
                  {t('I agree to the')}{' '}
                  <Link href="/terms" className="font-semibold text-[var(--auth-text)] underline underline-offset-2">
                    {t('Terms of Service')}
                  </Link>{' '}
                  {t('and')}{' '}
                  <Link href="/privacy" className="font-semibold text-[var(--auth-text)] underline underline-offset-2">
                    {t('Privacy Policy')}
                  </Link>
                </Checkbox>
              </>
            ) : null}

            {view === 'profile' ? (
              <>
                <Field label={t('Your name')}>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value.slice(0, 40))}
                    placeholder={t('Enter your name')}
                    autoComplete="name"
                    autoCapitalize="words"
                    enterKeyHint="next"
                    className="auth-input2"
                  />
                </Field>
                <Field
                  label={t('Username')}
                  note={<UsernameNote username={username} status={availability} />}
                  invalid={availability === 'taken' || availability === 'invalid'}
                >
                  <AtSign className="h-4 w-4 shrink-0 text-[var(--auth-muted)]" strokeWidth={2} />
                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20))}
                    placeholder={t('username')}
                    autoComplete="off"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    enterKeyHint="go"
                    className="auth-input2"
                  />
                  {availability === 'checking' ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[var(--auth-muted)]" />
                  ) : availability === 'available' ? (
                    <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" strokeWidth={2.8} />
                  ) : null}
                </Field>
              </>
            ) : null}
          </div>

          {alert}

          {view === 'sent' ? (
            <button type="button" onClick={() => go('signin')} className="auth-button mt-8 ed-focus">
              {t('Back to sign in')}
            </button>
          ) : (
            <button type="submit" disabled={busy} className="auth-button mt-7 ed-focus">
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : button}
            </button>
          )}

          {view === 'email' ? (
            <button
              type="button"
              onClick={() => {
                setByUsername(true)
                setIdentifier('')
                setPassword('')
                go('signin')
              }}
              className="ed-focus mx-auto mt-5 block rounded text-[0.85rem] font-medium text-[var(--auth-muted)] underline-offset-2 hover:text-[var(--auth-text)] hover:underline"
            >
              {t('Sign in with a username instead')}
            </button>
          ) : null}

          {view === 'profile' ? (
            <p className="mt-4 text-center text-[0.75rem] leading-relaxed text-[var(--auth-muted)]">
              {t('By creating an account you agree to our')}{' '}
              <Link href="/terms" className="font-semibold text-[var(--auth-text)] underline-offset-2 hover:underline">
                {t('Terms of Service')}
              </Link>{' '}
              {t('and')}{' '}
              <Link href="/privacy" className="font-semibold text-[var(--auth-text)] underline-offset-2 hover:underline">
                {t('Privacy Policy')}
              </Link>
              .
            </p>
          ) : null}
        </div>

        <div className="min-h-8 flex-1" />
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
      <span className="mb-2 block text-[0.88rem] font-semibold text-[var(--auth-text)]">{label}</span>
      <span className={cn('auth-box', invalid && 'is-invalid')}>{children}</span>
      {note ? <span className="mt-1.5 block text-[0.78rem] leading-snug text-[var(--auth-muted)]">{note}</span> : null}
    </label>
  )
}

function PasswordField({
  label,
  placeholder,
  value,
  onChange,
  autoComplete,
  enterKeyHint,
  note,
  invalid = false,
  ok = false,
  autoFocus = false,
}: {
  label: string
  placeholder: string
  value: string
  onChange: (value: string) => void
  autoComplete: string
  enterKeyHint: 'next' | 'go'
  note?: string
  invalid?: boolean
  ok?: boolean
  autoFocus?: boolean
}) {
  const t = useT()
  const [shown, setShown] = useState(false)
  return (
    <Field label={label} note={note} invalid={invalid}>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, 128))}
        placeholder={placeholder}
        type={shown ? 'text' : 'password'}
        autoComplete={autoComplete}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint={enterKeyHint}
        autoFocus={autoFocus}
        className="auth-input2"
      />
      {ok ? <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" strokeWidth={2.8} /> : null}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          setShown((v) => !v)
        }}
        aria-label={shown ? t('Hide password') : t('Show password')}
        className="ed-focus -mr-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--auth-muted)] hover:text-[var(--auth-text)]"
      >
        {shown ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
      </button>
    </Field>
  )
}

function Checkbox({
  checked,
  onChange,
  children,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  children: React.ReactNode
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 text-[0.85rem] leading-snug text-[var(--auth-muted)]">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span className={cn('auth-check mt-[1px] peer-focus-visible:ring-2', checked && 'is-on')} aria-hidden>
        {checked ? <Check className="h-3 w-3" strokeWidth={3.4} /> : null}
      </span>
      <span>{children}</span>
    </label>
  )
}

interface EmailCheck {
  ok: boolean
  taken?: boolean | null
  suggestion?: string
  error?: string
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
      <span className="font-medium text-emerald-700 dark:text-emerald-400">
        {t('@{username} is yours if you want it.', { username })}
      </span>
    )
  }
  if (status === 'taken') {
    return <span className="font-medium text-rose-600">{t('@{username} is already taken.', { username })}</span>
  }
  if (status === 'invalid') {
    return <span className="font-medium text-rose-600">{t('Use 3–20 letters, numbers or underscores.')}</span>
  }
  return <span>{t("Your profile link. It can't be changed later.")}</span>
}
