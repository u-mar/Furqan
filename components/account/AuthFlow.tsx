'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, AtSign, Check, CircleAlert, Eye, EyeOff, Loader2, MailCheck, X } from 'lucide-react'
import GoogleButton from '@/components/account/GoogleButton'
import { loginLocalUser, setSignedInUser, type AppUser } from '@/lib/auth'
import { cn } from '@/lib/cn'
import { tr, useT } from '@/lib/i18n'

type View = 'signin' | 'signup' | 'profile' | 'forgot' | 'sent'

const USERNAME_RULE = /^[a-z0-9_]{3,20}$/
const EMAIL_RULE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const MIN_PASSWORD = 8

interface AuthFlowProps {
  /** Which screen to open on. `welcome` and `signup` open on Sign up. */
  start?: 'welcome' | 'signup' | 'login'
  onDone: () => void
  /** Offered when the app works without an account. */
  onSkip?: () => void
  onClose?: () => void
  /** Shown under the Sign up title in place of the usual line, e.g. "Create a free account to follow qaris." */
  reason?: string
}

/**
 * Signing in and creating an account with an email and password, or with Google.
 *
 * Sign in and Sign up are two faces of one screen, switched by the line at the
 * bottom. A new account then gets one short step for the name and username its
 * recitations go under. Accounts made before emails sign in with their
 * username, their 4-digit PIN serving as the password.
 */
export default function AuthFlow({ start = 'welcome', onDone, onSkip, onClose, reason }: AuthFlowProps) {
  const t = useT()
  const [view, setView] = useState<View>(start === 'login' ? 'signin' : 'signup')
  const [identifier, setIdentifier] = useState('')
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
    view === 'signin'
      ? identifier.trim().length > 0 && password.length > 0
      : view === 'signup'
        ? emailOk && passwordOk && confirmOk && agreed
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

  // The email is looked up as soon as it looks complete, while the passwords are
  // still being typed, so "Sign up" usually has its answer already.
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
    if (view !== 'signup' || !EMAIL_RULE.test(email.trim())) return
    const timer = window.setTimeout(() => void checkEmail(email.trim()).catch(() => {}), 500)
    return () => window.clearTimeout(timer)
  }, [checkEmail, email, view])

  const continueSignUp = async () => {
    try {
      const data = await checkEmail(email.trim())
      if (!data.ok) return fail(data.error ? tr(data.error) : tr('Enter a valid email address.'))
      if (data.taken) return fail(tr('An account with this email already exists. Sign in instead.'))
      if (!username && data.suggestion) setUsername(data.suggestion)
      go('profile')
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
          // New here: the name and username step, on this same screen.
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
    if (view === 'signin') return tr('Enter your email and password.')
    if (view === 'signup' || view === 'forgot') {
      if (!emailOk) return tr('Enter a valid email address.')
      if (view === 'forgot') return ''
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
      const reason = missing()
      if (reason) fail(reason)
      return
    }
    setBusy(true)
    setError('')
    try {
      if (view === 'signin') await signIn()
      else if (view === 'signup') await continueSignUp()
      else if (view === 'profile') await createAccount()
      else if (view === 'forgot') await sendReset()
    } finally {
      setBusy(false)
    }
  }

  /* --- words for each screen --- */

  const heading = {
    signin: { title: t('Sign in'), line: t("Welcome back, you've been missed.") },
    signup: { title: t('Sign up'), line: reason ?? t('Just a few quick things to get started.') },
    profile: { title: t('Almost done'), line: t('Pick the name and username your recitations will go under.') },
    forgot: { title: t('Forgot password'), line: t("Enter your email and we'll send you a link to choose a new password.") },
    sent: { title: t('Check your email'), line: '' },
  }[view]

  const button = {
    signin: t('Sign in'),
    signup: t('Sign up'),
    profile: t('Create account'),
    forgot: t('Send reset link'),
    sent: '',
  }[view]

  const back =
    view === 'profile'
      ? () => {
          setGoogle(null)
          go('signup')
        }
      : view === 'forgot' || view === 'sent'
        ? () => go('signin')
        : null

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
        <div className="flex h-11 items-center justify-between">
          {back ? (
            <button type="button" onClick={back} aria-label={t('Back')} className="auth-icon-button ed-focus -ml-2">
              <ArrowLeft className="h-5 w-5" strokeWidth={2} />
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

        <div key={view} className="auth-step mt-6">
          {view === 'sent' ? (
            <span className="auth-badge mb-5 flex h-14 w-14 items-center justify-center rounded-2xl">
              <MailCheck className="h-7 w-7" strokeWidth={1.8} />
            </span>
          ) : null}
          <h1 className="text-[1.85rem] font-bold leading-tight tracking-[-0.025em] text-[var(--auth-text)]">{heading.title}</h1>
          {heading.line ? <p className="mt-1.5 text-[0.95rem] leading-snug text-[var(--auth-muted)]">{heading.line}</p> : null}
          {view === 'sent' ? (
            <p className="mt-2 text-[0.95rem] leading-relaxed text-[var(--auth-muted)]">
              {t('If an account uses {email}, a link to reset your password is on its way. It works for 30 minutes.', {
                email: email.trim(),
              })}
            </p>
          ) : null}

          <div className="mt-8 space-y-5">
            {view === 'signin' ? (
              <>
                <Field label={t('Email or username')}>
                  <input
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value.slice(0, 254))}
                    placeholder={t('Enter your email or username')}
                    type="text"
                    inputMode="email"
                    autoComplete="username"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    enterKeyHint="next"
                    className="auth-input2"
                  />
                </Field>
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
                <Field label={t('Email')}>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value.slice(0, 254))}
                    placeholder={t('Enter your email')}
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    enterKeyHint="next"
                    className="auth-input2"
                  />
                </Field>
                <PasswordField
                  label={t('New password')}
                  placeholder={t('At least 8 characters')}
                  value={password}
                  onChange={setPassword}
                  autoComplete="new-password"
                  enterKeyHint="next"
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

            {view === 'forgot' ? (
              <Field label={t('Email')}>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value.slice(0, 254))}
                  placeholder={t('Enter your email')}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="send"
                  className="auth-input2"
                />
              </Field>
            ) : null}
          </div>

          {error ? (
            <p key={shake} className="auth-shake auth-alert" role="alert">
              <CircleAlert className="h-4 w-4 shrink-0" strokeWidth={2.2} />
              <span>
                {error}
                {view === 'signup' && error === tr('An account with this email already exists. Sign in instead.') ? (
                  <>
                    {' '}
                    <button
                      type="button"
                      onClick={() => {
                        setIdentifier(email.trim())
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
          ) : null}

          {view === 'sent' ? (
            <button type="button" onClick={() => go('signin')} className="auth-button mt-8 ed-focus">
              {t('Back to sign in')}
            </button>
          ) : (
            <button type="submit" disabled={busy} className="auth-button mt-7 ed-focus">
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : button}
            </button>
          )}

          {view === 'signin' || view === 'signup' ? (
            <>
              <div className="my-6 flex items-center gap-3 text-[0.8rem] text-[var(--auth-muted)]">
                <span className="h-px flex-1 bg-[var(--auth-line)]" />
                {t('Or with')}
                <span className="h-px flex-1 bg-[var(--auth-line)]" />
              </div>
              <GoogleButton
                onCredential={(c) => void withGoogle(c)}
                onError={fail}
                disabled={busy}
                text={view === 'signin' ? 'signin_with' : 'continue_with'}
              />
            </>
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

        {view === 'signin' || view === 'signup' ? (
          <div className="space-y-2 pt-4 text-center text-[0.88rem] text-[var(--auth-muted)]">
            <p>
              {view === 'signin' ? t("Don't have an account?") : t('Already have an account?')}{' '}
              <button
                type="button"
                onClick={() => {
                  setPassword('')
                  setConfirm('')
                  go(view === 'signin' ? 'signup' : 'signin')
                }}
                className="ed-focus rounded font-semibold text-[var(--auth-text)] underline underline-offset-[3px]"
              >
                {view === 'signin' ? t('Sign up') : t('Sign in')}
              </button>
            </p>
            {onSkip ? (
              <button type="button" onClick={onSkip} className="ed-focus rounded py-1 font-medium hover:text-[var(--auth-text)]">
                {t('Continue without an account')}
              </button>
            ) : null}
          </div>
        ) : null}
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
