'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import PinField from '@/components/account/PinField'
import { cn } from '@/lib/cn'
import { loginLocalUser, setSignedInUser, signupLocalUser } from '@/lib/auth'

export interface AccountFormProps {
  initialMode?: 'signup' | 'login'
  onSuccess: () => void
  compact?: boolean
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
  disabled,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  autoComplete?: string
  disabled?: boolean
}) {
  return (
    <label className="block px-4 py-3.5">
      <span className="mb-1.5 block text-xs font-medium text-[var(--home-muted)]">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        disabled={disabled}
        placeholder={placeholder}
        className="w-full bg-transparent text-[15px] text-[var(--home-heading)] placeholder:text-[var(--home-muted)]/70 focus:outline-none disabled:opacity-50"
      />
    </label>
  )
}

export default function AccountForm({
  initialMode = 'signup',
  onSuccess,
  compact = false,
}: AccountFormProps) {
  const [mode, setMode] = useState<'signup' | 'login'>(initialMode)
  const [username, setUsername] = useState('')
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    if (!username.trim() || pin.length < 4) return
    if (mode === 'signup' && !name.trim()) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: mode,
          username: username.trim(),
          name: name.trim(),
          pin: pin.trim(),
        }),
      })
      const raw = await res.text()
      let data: { error?: string; user?: { id: string; username: string; name: string } } = {}
      try {
        data = raw ? (JSON.parse(raw) as typeof data) : {}
      } catch {
        data = {}
      }
      if (!res.ok || !data.user) {
        const msg = data.error || `Could not continue (HTTP ${res.status}).`
        if (msg.toLowerCase().includes('database is not configured')) {
          const localUser =
            mode === 'signup'
              ? signupLocalUser(username.trim(), name.trim(), pin.trim())
              : loginLocalUser(username.trim(), pin.trim())
          setSignedInUser(localUser)
          onSuccess()
          return
        }
        setError(msg)
        return
      }
      setSignedInUser(data.user)
      onSuccess()
    } catch {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        try {
          const localUser =
            mode === 'signup'
              ? signupLocalUser(username.trim(), name.trim(), pin.trim())
              : loginLocalUser(username.trim(), pin.trim())
          setSignedInUser(localUser)
          onSuccess()
          return
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Could not create account.')
          return
        }
      }
      setError('Could not reach the server. Check your connection.')
    } finally {
      setBusy(false)
    }
  }

  const canSubmit =
    username.trim().length > 0 && pin.length === 4 && (mode === 'login' || name.trim().length > 0)

  return (
    <div className={cn('space-y-5', compact && 'space-y-4')}>
      <div className="overflow-hidden rounded-2xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] shadow-[var(--home-card-shadow)]">
        <Field
          label="Username"
          value={username}
          onChange={setUsername}
          placeholder="ahmad"
          autoComplete="username"
          disabled={busy}
        />
        {mode === 'signup' ? (
          <>
            <div className="mx-4 border-t border-[var(--home-card-border)]" />
            <Field
              label="Name"
              value={name}
              onChange={setName}
              placeholder="How we greet you"
              autoComplete="name"
              disabled={busy}
            />
          </>
        ) : null}
      </div>

      <PinField value={pin} onChange={setPin} disabled={busy} />

      {error ? (
        <p className="text-sm leading-relaxed text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        disabled={busy || !canSubmit}
        onClick={() => void submit()}
        className="flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-[var(--home-sage-deep)] text-[15px] font-semibold text-white transition-opacity active:scale-[0.99] disabled:opacity-40"
      >
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : mode === 'signup' ? 'Continue' : 'Sign in'}
      </button>

      <p className="text-center text-sm text-[var(--home-muted)]">
        {mode === 'signup' ? (
          <>
            Already registered?{' '}
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setMode('login')
                setError('')
              }}
              className="font-semibold text-[var(--home-sage-deep)] underline-offset-2 hover:underline disabled:opacity-50"
            >
              Sign in
            </button>
          </>
        ) : (
          <>
            First time here?{' '}
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setMode('signup')
                setError('')
              }}
              className="font-semibold text-[var(--home-sage-deep)] underline-offset-2 hover:underline disabled:opacity-50"
            >
              Create account
            </button>
          </>
        )}
      </p>
    </div>
  )
}
