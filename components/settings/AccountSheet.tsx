'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { loginLocalUser, setSignedInUser, signupLocalUser } from '@/lib/auth'

interface AccountSheetProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function AccountSheet({ open, onClose, onSuccess }: AccountSheetProps) {
  const [mode, setMode] = useState<'signup' | 'login'>('signup')
  const [username, setUsername] = useState('')
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setError('')
    setPin('')
  }, [open, mode])

  if (!open) return null

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
          onClose()
          return
        }
        setError(msg)
        return
      }
      setSignedInUser(data.user)
      onSuccess()
      onClose()
    } catch {
      setError('Could not connect to server.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 px-4 pb-4 pt-10 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-sheet-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-3xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="account-sheet-title" className="home-serif text-xl font-semibold text-[var(--home-heading)]">
              {mode === 'signup' ? 'Create account' : 'Sign in'}
            </h2>
            <p className="mt-0.5 text-xs text-[var(--home-muted)]">Username, name, and 4-digit PIN</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--home-muted)] hover:bg-[var(--app-surface)]"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-2 rounded-xl border border-[var(--home-card-border)] bg-[var(--app-surface)] p-1">
          <button
            type="button"
            onClick={() => setMode('signup')}
            className={cn(
              'rounded-lg py-2 text-sm font-semibold',
              mode === 'signup' ? 'bg-[var(--home-sage-deep)] text-white' : 'text-[var(--home-muted)]'
            )}
          >
            Sign up
          </button>
          <button
            type="button"
            onClick={() => setMode('login')}
            className={cn(
              'rounded-lg py-2 text-sm font-semibold',
              mode === 'login' ? 'bg-[var(--home-sage-deep)] text-white' : 'text-[var(--home-muted)]'
            )}
          >
            Log in
          </button>
        </div>

        <div className="space-y-2">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
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
          disabled={busy || !username.trim() || !pin.trim() || (mode === 'signup' && !name.trim())}
          className="mt-4 w-full rounded-xl bg-[var(--home-sage-deep)] px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
        >
          {busy ? 'Please wait...' : mode === 'signup' ? 'Create account' : 'Sign in'}
        </button>
      </div>
    </div>
  )
}
