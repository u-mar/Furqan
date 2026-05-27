'use client'

import { useEffect, useMemo, useState } from 'react'
import { getSignedInUser, setSignedInUser } from '@/lib/auth'

type Mode = 'signup' | 'login'

export default function AuthGate() {
  const [ready, setReady] = useState(false)
  const [mode, setMode] = useState<Mode>('signup')
  const [username, setUsername] = useState('')
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setReady(Boolean(getSignedInUser()))
    const onAuthChanged = () => setReady(Boolean(getSignedInUser()))
    window.addEventListener('auth-user-changed', onAuthChanged)
    return () => window.removeEventListener('auth-user-changed', onAuthChanged)
  }, [])

  const canSubmit = useMemo(() => {
    if (submitting) return false
    if (!username.trim() || !pin.trim()) return false
    if (mode === 'signup' && !name.trim()) return false
    return true
  }, [mode, name, pin, submitting, username])

  const submit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: mode,
          username,
          name,
          pin,
        }),
      })
      const data = (await res.json()) as { error?: string; user?: { id: string; username: string; name: string } }
      if (!res.ok || !data.user) {
        setError(data.error || 'Could not continue. Please try again.')
        return
      }
      setSignedInUser(data.user)
      setPin('')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (ready) return null

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-md rounded-3xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] p-5 shadow-2xl">
        <h2 className="home-serif text-2xl font-semibold text-[var(--home-heading)]">Welcome</h2>
        <p className="mt-1 text-sm text-[var(--home-muted)]">
          {mode === 'signup'
            ? 'Create your account first time with username, name, and a 4-digit PIN.'
            : 'Sign in with your username and 4-digit PIN.'}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl border border-[var(--home-card-border)] bg-[var(--app-surface)] p-1">
          <button
            type="button"
            onClick={() => {
              setMode('signup')
              setError('')
            }}
            className={`rounded-lg px-3 py-2 text-sm font-semibold ${
              mode === 'signup' ? 'bg-[var(--home-sage-deep)] text-white' : 'text-[var(--home-muted)]'
            }`}
          >
            Sign up
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('login')
              setError('')
            }}
            className={`rounded-lg px-3 py-2 text-sm font-semibold ${
              mode === 'login' ? 'bg-[var(--home-sage-deep)] text-white' : 'text-[var(--home-muted)]'
            }`}
          >
            Log in
          </button>
        </div>

        <div className="mt-4 space-y-2">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username (letters, numbers, _)"
            className="w-full rounded-xl border border-[var(--home-card-border)] bg-[var(--app-surface)] px-3 py-2 text-sm"
          />
          {mode === 'signup' ? (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              className="w-full rounded-xl border border-[var(--home-card-border)] bg-[var(--app-surface)] px-3 py-2 text-sm"
            />
          ) : null}
          <input
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="4-digit PIN"
            inputMode="numeric"
            className="w-full rounded-xl border border-[var(--home-card-border)] bg-[var(--app-surface)] px-3 py-2 text-sm"
          />
        </div>

        {error ? <p className="mt-2 text-xs text-red-500">{error}</p> : null}

        <button
          type="button"
          onClick={() => void submit()}
          disabled={!canSubmit}
          className="mt-4 w-full rounded-xl bg-[var(--home-sage-deep)] px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
        >
          {submitting ? 'Please wait...' : mode === 'signup' ? 'Create account' : 'Sign in'}
        </button>
      </div>
    </div>
  )
}
