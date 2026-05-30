'use client'

import { useEffect, useState } from 'react'
import { Loader2, UserPlus } from 'lucide-react'
import { cn } from '@/lib/cn'
import { loginLocalUser, setSignedInUser, signupLocalUser } from '@/lib/auth'

export interface AccountFormProps {
  initialMode?: 'signup' | 'login'
  onSuccess: () => void
  onModeChange?: (mode: 'signup' | 'login') => void
  compact?: boolean
}

export default function AccountForm({
  initialMode = 'signup',
  onSuccess,
  onModeChange,
  compact = false,
}: AccountFormProps) {
  const [mode, setMode] = useState<'signup' | 'login'>(initialMode)
  const [username, setUsername] = useState('')
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    onModeChange?.(mode)
  }, [mode, onModeChange])

  async function submit() {
    if (!username.trim() || !pin.trim()) return
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
      setError('Could not connect to server. Try again on Wi‑Fi.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={cn('space-y-4', compact && 'space-y-3')}>
      <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-[var(--home-card-border)] bg-[var(--app-surface)] p-1">
        <button
          type="button"
          onClick={() => setMode('signup')}
          className={cn(
            'rounded-xl py-2.5 text-sm font-semibold transition-colors',
            mode === 'signup'
              ? 'bg-[var(--home-sage-deep)] text-white shadow-sm'
              : 'text-[var(--home-muted)] hover:text-[var(--home-heading)]'
          )}
        >
          Create account
        </button>
        <button
          type="button"
          onClick={() => setMode('login')}
          className={cn(
            'rounded-xl py-2.5 text-sm font-semibold transition-colors',
            mode === 'login'
              ? 'bg-[var(--home-sage-deep)] text-white shadow-sm'
              : 'text-[var(--home-muted)] hover:text-[var(--home-heading)]'
          )}
        >
          Sign in
        </button>
      </div>

      <div className="space-y-2.5">
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-[var(--home-muted)]">Username</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            placeholder="e.g. ahmad"
            className="w-full rounded-xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] px-3.5 py-2.5 text-sm text-[var(--app-text)] placeholder:text-[var(--home-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--home-sage-deep)]/25"
          />
        </label>
        {mode === 'signup' ? (
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-[var(--home-muted)]">Your name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              placeholder="Display name"
              className="w-full rounded-xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] px-3.5 py-2.5 text-sm text-[var(--app-text)] placeholder:text-[var(--home-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--home-sage-deep)]/25"
            />
          </label>
        ) : null}
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-[var(--home-muted)]">4-digit PIN</span>
          <input
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            inputMode="numeric"
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            placeholder="••••"
            maxLength={4}
            className="w-full rounded-xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] px-3.5 py-2.5 text-center text-lg tracking-[0.35em] text-[var(--app-text)] placeholder:tracking-normal placeholder:text-[var(--home-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--home-sage-deep)]/25"
          />
        </label>
      </div>

      {error ? (
        <p className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : null}

      <button
        type="button"
        disabled={busy || !username.trim() || pin.length < 4 || (mode === 'signup' && !name.trim())}
        onClick={() => void submit()}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--home-sage-deep)] py-3.5 text-sm font-bold text-white shadow-md shadow-[rgba(93,122,72,0.3)] transition-opacity disabled:opacity-45"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <UserPlus className="h-4 w-4" />
        )}
        {busy ? 'Please wait…' : mode === 'signup' ? 'Create my account' : 'Sign in'}
      </button>
    </div>
  )
}
