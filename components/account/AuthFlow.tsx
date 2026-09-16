'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AtSign, BookOpen, Check, ChevronLeft, Loader2, Mic, Sparkles, X } from 'lucide-react'
import AppMark from '@/components/account/AppMark'
import { APP_NAME } from '@/lib/app-brand'
import { loginLocalUser, setSignedInUser, signupLocalUser, type AppUser } from '@/lib/auth'
import { cn } from '@/lib/cn'

type Step = 'welcome' | 'name' | 'username' | 'pin' | 'confirm' | 'login-username' | 'login-pin'

const USERNAME_RULE = /^[a-z0-9_]{3,20}$/

interface AuthFlowProps {
  /** `welcome` shows the introduction first; the others go straight in. */
  start?: 'welcome' | 'signup' | 'login'
  onDone: () => void
  /** Offered only alongside the introduction — the app works without one. */
  onSkip?: () => void
  onClose?: () => void
}

/**
 * Creating an account and signing in, one question per screen.
 *
 * A single form asking for a name, a username and a PIN at once is where
 * people give up on a phone: small fields, the keyboard covering half of
 * them, and errors that only appear after submitting. One question at a time
 * keeps every target large and every problem next to the thing that caused
 * it — the username is checked while it is typed, and the PIN is entered
 * twice so a slip does not lock someone out of an account they just made.
 */
export default function AuthFlow({ start = 'welcome', onDone, onSkip, onClose }: AuthFlowProps) {
  const first: Step = start === 'login' ? 'login-username' : start === 'signup' ? 'name' : 'welcome'
  const [step, setStep] = useState<Step>(first)
  const [history, setHistory] = useState<Step[]>([])

  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [pin, setPin] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [shake, setShake] = useState(0)

  const go = useCallback((next: Step) => {
    setHistory((h) => [...h, step])
    setStep(next)
    setError('')
  }, [step])

  const back = useCallback(() => {
    setError('')
    setHistory((h) => {
      const prev = h[h.length - 1]
      if (prev) {
        setStep(prev)
        if (prev === 'pin') setConfirm('')
        return h.slice(0, -1)
      }
      onClose?.()
      return h
    })
  }, [onClose])

  const fail = useCallback((message: string) => {
    setError(message)
    setShake((n) => n + 1)
  }, [])

  const signupFlow = ['name', 'username', 'pin', 'confirm'] as const
  const loginFlow = ['login-username', 'login-pin'] as const
  const flow: readonly Step[] = (signupFlow as readonly Step[]).includes(step) ? signupFlow : loginFlow
  const position = flow.indexOf(step)

  /* --- submission --- */

  const submit = useCallback(
    async (mode: 'signup' | 'login', finalPin: string) => {
      setBusy(true)
      setError('')
      const cleanUsername = username.trim().toLowerCase()

      const finish = (user: AppUser) => {
        setSignedInUser(user)
        onDone()
      }
      const useLocal = () =>
        finish(
          mode === 'signup'
            ? signupLocalUser(cleanUsername, name.trim(), finalPin)
            : loginLocalUser(cleanUsername, finalPin)
        )

      try {
        const res = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: mode, username: cleanUsername, name: name.trim(), pin: finalPin }),
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
        fail(data.error || 'Something went wrong. Please try again.')
      } catch {
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          try {
            useLocal()
            return
          } catch (err) {
            fail(err instanceof Error ? err.message : 'Could not continue.')
            return
          }
        }
        fail('Could not reach the server. Check your connection.')
      } finally {
        setBusy(false)
      }
    },
    [fail, name, onDone, username]
  )

  /* --- screens --- */

  return (
    <div className="flex h-full min-h-0 flex-col">
      {step !== 'welcome' ? (
        <header className="flex items-center justify-between px-5 pt-[max(1rem,env(safe-area-inset-top))]">
          <button
            type="button"
            onClick={back}
            aria-label="Back"
            className="ed-focus -ml-2 flex h-11 w-11 items-center justify-center rounded-full text-[var(--home-heading)] transition-colors hover:bg-[var(--home-track)]"
          >
            <ChevronLeft className="h-6 w-6" strokeWidth={1.8} />
          </button>
          <div className="flex gap-1.5" aria-hidden>
            {flow.map((s, i) => (
              <span
                key={s}
                className="h-1.5 rounded-full transition-all duration-300"
                style={{
                  width: i === position ? 22 : 6,
                  background: i <= position ? 'var(--home-sage-deep)' : 'var(--home-track)',
                }}
              />
            ))}
          </div>
          <span className="w-11" />
        </header>
      ) : onClose ? (
        <header className="flex justify-end px-5 pt-[max(1rem,env(safe-area-inset-top))]">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="ed-focus -mr-2 flex h-11 w-11 items-center justify-center rounded-full text-[var(--home-muted)] transition-colors hover:bg-[var(--home-track)]"
          >
            <X className="h-5 w-5" strokeWidth={1.8} />
          </button>
        </header>
      ) : null}

      <div key={step} className="auth-step flex min-h-0 flex-1 flex-col px-6">
        {step === 'welcome' ? (
          <Welcome
            onCreate={() => go('name')}
            onLogin={() => go('login-username')}
            onSkip={onSkip}
          />
        ) : null}

        {step === 'name' ? (
          <TextStep
            title="What should we call you?"
            hint="This is the name people see on your recitations."
            value={name}
            onChange={(v) => setName(v.slice(0, 40))}
            placeholder="Your name"
            autoComplete="name"
            error={error}
            shake={shake}
            canContinue={name.trim().length >= 2}
            onContinue={() => go('username')}
          />
        ) : null}

        {step === 'username' ? (
          <UsernameStep
            value={username}
            onChange={setUsername}
            error={error}
            shake={shake}
            onContinue={() => go('pin')}
          />
        ) : null}

        {step === 'pin' ? (
          <PinStep
            title="Create a 4-digit PIN"
            hint="You'll use it to sign in. Pick something you'll remember."
            value={pin}
            onChange={setPin}
            error={error}
            shake={shake}
            onComplete={() => go('confirm')}
          />
        ) : null}

        {step === 'confirm' ? (
          <PinStep
            title="Enter it once more"
            hint="Just to be sure there was no slip."
            value={confirm}
            onChange={(v) => {
              setConfirm(v)
              if (error) setError('')
            }}
            error={error}
            shake={shake}
            busy={busy}
            onComplete={(entered) => {
              if (entered !== pin) {
                setConfirm('')
                fail("Those PINs don't match. Try again.")
                return
              }
              void submit('signup', entered)
            }}
          />
        ) : null}

        {step === 'login-username' ? (
          <TextStep
            title="Welcome back"
            hint="Enter the username you signed up with."
            value={username}
            onChange={(v) => setUsername(v.toLowerCase().replace(/\s/g, '').slice(0, 20))}
            placeholder="username"
            autoComplete="username"
            prefix={<AtSign className="h-5 w-5" strokeWidth={2} />}
            error={error}
            shake={shake}
            canContinue={USERNAME_RULE.test(username)}
            onContinue={() => go('login-pin')}
          />
        ) : null}

        {step === 'login-pin' ? (
          <PinStep
            title="Enter your PIN"
            hint={`Signing in as @${username}`}
            value={pin}
            onChange={(v) => {
              setPin(v)
              if (error) setError('')
            }}
            error={error}
            shake={shake}
            busy={busy}
            onComplete={(entered) => void submit('login', entered)}
          />
        ) : null}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------------ */

function Welcome({
  onCreate,
  onLogin,
  onSkip,
}: {
  onCreate: () => void
  onLogin: () => void
  onSkip?: () => void
}) {
  return (
    <div className="flex flex-1 flex-col pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <AppMark className="mb-6 h-20 w-20 rounded-[1.4rem]" />
        <h1 className="home-serif text-[2.1rem] font-semibold leading-tight tracking-[-0.02em] text-[var(--home-heading)]">
          {APP_NAME}
        </h1>
        <p className="mt-2 text-[0.95rem] text-[var(--home-muted)]">The Quran, wherever you are.</p>

        <ul className="mt-9 w-full max-w-[19rem] space-y-4 text-left">
          <Benefit Icon={BookOpen} text="Pick up exactly where you stopped reading" />
          <Benefit Icon={Sparkles} text="Save the recitations you love to Favourites" />
          <Benefit Icon={Mic} text="Share your recitation with the Qari community" />
        </ul>
      </div>

      <div className="space-y-3">
        <button type="button" onClick={onCreate} className="auth-primary ed-focus">
          Create account
        </button>
        <button type="button" onClick={onLogin} className="auth-secondary ed-focus">
          I already have an account
        </button>
        {onSkip ? (
          <button
            type="button"
            onClick={onSkip}
            className="ed-focus w-full py-2.5 text-[0.92rem] font-medium text-[var(--home-muted)] transition-colors hover:text-[var(--home-heading)]"
          >
            Continue without an account
          </button>
        ) : null}
        <p className="px-4 pt-1 text-center text-[11px] leading-relaxed text-[var(--home-muted)]">
          By creating an account you agree to our{' '}
          <Link href="/terms" className="font-semibold text-[var(--home-heading)] underline-offset-2 hover:underline">
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className="font-semibold text-[var(--home-heading)] underline-offset-2 hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </div>
  )
}

function Benefit({ Icon, text }: { Icon: typeof BookOpen; text: string }) {
  return (
    <li className="flex items-center gap-3.5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--home-sage-soft)] text-[var(--home-sage-deep)]">
        <Icon className="h-5 w-5" strokeWidth={1.9} />
      </span>
      <span className="text-[0.92rem] leading-snug text-[var(--home-heading)]">{text}</span>
    </li>
  )
}

function StepHeading({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="pt-8">
      <h2 className="home-serif text-[1.85rem] font-semibold leading-[1.15] tracking-[-0.02em] text-[var(--home-heading)]">
        {title}
      </h2>
      <p className="mt-2 text-[0.95rem] leading-relaxed text-[var(--home-muted)]">{hint}</p>
    </div>
  )
}

function ErrorLine({ error, shake }: { error: string; shake: number }) {
  if (!error) return null
  return (
    <p key={shake} className="auth-shake mt-3 text-[0.88rem] font-medium text-rose-500" role="alert">
      {error}
    </p>
  )
}

function TextStep({
  title,
  hint,
  value,
  onChange,
  placeholder,
  autoComplete,
  prefix,
  error,
  shake,
  canContinue,
  onContinue,
}: {
  title: string
  hint: string
  value: string
  onChange: (v: string) => void
  placeholder: string
  autoComplete: string
  prefix?: React.ReactNode
  error: string
  shake: number
  canContinue: boolean
  onContinue: () => void
}) {
  return (
    <form
      className="flex flex-1 flex-col pb-[max(1.5rem,env(safe-area-inset-bottom))]"
      onSubmit={(e) => {
        e.preventDefault()
        if (canContinue) onContinue()
      }}
    >
      <StepHeading title={title} hint={hint} />
      <div className="auth-field mt-8">
        {prefix ? <span className="text-[var(--home-muted)]">{prefix}</span> : null}
        <input
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          autoCapitalize={autoComplete === 'name' ? 'words' : 'none'}
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="next"
          className="min-w-0 flex-1 bg-transparent text-[1.2rem] font-medium text-[var(--home-heading)] placeholder:font-normal placeholder:text-[var(--home-muted)] focus:outline-none"
        />
      </div>
      <ErrorLine error={error} shake={shake} />
      <div className="flex-1" />
      <button type="submit" disabled={!canContinue} className="auth-primary ed-focus">
        Continue
      </button>
    </form>
  )
}

type Availability = 'idle' | 'invalid' | 'checking' | 'available' | 'taken' | 'unknown'

function UsernameStep({
  value,
  onChange,
  error,
  shake,
  onContinue,
}: {
  value: string
  onChange: (v: string) => void
  error: string
  shake: number
  onContinue: () => void
}) {
  const [status, setStatus] = useState<Availability>('idle')
  const latest = useRef(value)

  // Checked as it is typed, so a taken name is known before Continue.
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

  const canContinue = status === 'available' || status === 'unknown'

  const note: Record<Availability, { text: string; tone: 'muted' | 'good' | 'bad' }> = {
    idle: { text: '3–20 letters, numbers or underscores.', tone: 'muted' },
    invalid: { text: 'Use 3–20 letters, numbers or underscores.', tone: 'bad' },
    checking: { text: 'Checking…', tone: 'muted' },
    available: { text: `@${value} is yours if you want it.`, tone: 'good' },
    taken: { text: `@${value} is already taken.`, tone: 'bad' },
    unknown: { text: "Couldn't check just now — we'll confirm when you finish.", tone: 'muted' },
  }

  return (
    <form
      className="flex flex-1 flex-col pb-[max(1.5rem,env(safe-area-inset-bottom))]"
      onSubmit={(e) => {
        e.preventDefault()
        if (canContinue) onContinue()
      }}
    >
      <StepHeading title="Pick a username" hint="Your profile link. It can't be changed later." />
      <div className="auth-field mt-8">
        <AtSign className="h-5 w-5 text-[var(--home-muted)]" strokeWidth={2} />
        <input
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20))}
          placeholder="username"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="next"
          className="min-w-0 flex-1 bg-transparent text-[1.2rem] font-medium text-[var(--home-heading)] placeholder:font-normal placeholder:text-[var(--home-muted)] focus:outline-none"
        />
        <span className="flex h-6 w-6 items-center justify-center" aria-hidden>
          {status === 'checking' ? (
            <Loader2 className="h-4 w-4 animate-spin text-[var(--home-muted)]" />
          ) : status === 'available' ? (
            <Check className="h-5 w-5 text-[var(--home-sage-deep)]" strokeWidth={2.6} />
          ) : null}
        </span>
      </div>
      <p
        className={cn(
          'mt-3 text-[0.88rem]',
          note[status].tone === 'good' && 'font-medium text-[var(--home-sage-deep)]',
          note[status].tone === 'bad' && 'font-medium text-rose-500',
          note[status].tone === 'muted' && 'text-[var(--home-muted)]'
        )}
        aria-live="polite"
      >
        {note[status].text}
      </p>
      <ErrorLine error={error} shake={shake} />
      <div className="flex-1" />
      <button type="submit" disabled={!canContinue} className="auth-primary ed-focus">
        Continue
      </button>
    </form>
  )
}

function PinStep({
  title,
  hint,
  value,
  onChange,
  onComplete,
  error,
  shake,
  busy,
}: {
  title: string
  hint: string
  value: string
  onChange: (v: string) => void
  onComplete: (pin: string) => void
  error: string
  shake: number
  busy?: boolean
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)

  return (
    <div className="flex flex-1 flex-col pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <StepHeading title={title} hint={hint} />

      <button
        type="button"
        onClick={() => inputRef.current?.focus()}
        disabled={busy}
        aria-label="Enter your 4-digit PIN"
        className={cn('mt-10 flex justify-center gap-3', error && 'auth-shake')}
        key={`pin-${shake}`}
      >
        {[0, 1, 2, 3].map((i) => {
          const filled = value.length > i
          const active = value.length === i && !busy
          return (
            <span
              key={i}
              className={cn(
                'flex h-[4.25rem] w-[3.6rem] items-center justify-center rounded-2xl border-2 transition-all duration-150',
                error
                  ? 'border-rose-400/70'
                  : filled
                    ? 'border-[var(--home-sage-deep)] bg-[var(--home-sage-soft)]'
                    : active
                      ? 'border-[var(--home-heading)]'
                      : 'border-[var(--home-rule-strong)]'
              )}
              aria-hidden
            >
              {filled ? <span className="h-3.5 w-3.5 rounded-full bg-[var(--home-heading)]" /> : null}
            </span>
          )
        })}
      </button>

      <input
        ref={inputRef}
        autoFocus
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        maxLength={4}
        value={value}
        disabled={busy}
        onChange={(e) => {
          const next = e.target.value.replace(/\D/g, '').slice(0, 4)
          onChange(next)
          if (next.length === 4) onComplete(next)
        }}
        className="sr-only"
        aria-label={title}
      />

      <div className="mt-6 flex min-h-[1.5rem] justify-center text-center">
        {busy ? (
          <Loader2 className="h-5 w-5 animate-spin text-[var(--home-muted)]" />
        ) : error ? (
          <p key={shake} className="text-[0.88rem] font-medium text-rose-500" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  )
}
