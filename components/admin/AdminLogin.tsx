'use client'

import { useState } from 'react'
import { Lock, Shield } from 'lucide-react'
import { loginAdmin } from '@/lib/admin-api'
import { APP_NAME } from '@/lib/app-brand'

interface AdminLoginProps {
  onSuccess: () => void
  configured: boolean
}

export default function AdminLogin({ onSuccess, configured }: AdminLoginProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await loginAdmin(username, password)
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center px-6 py-12">
      <div className="rounded-3xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] p-8 shadow-[var(--home-card-shadow)]">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--home-sage-soft)] text-[var(--home-sage-deep)]">
            <Shield className="h-6 w-6" />
          </span>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--home-muted)]">
              {APP_NAME}
            </p>
            <h1 className="home-serif text-2xl font-semibold text-[var(--home-heading)]">
              Admin sign in
            </h1>
          </div>
        </div>

        {!configured ? (
          <p className="mb-4 rounded-xl bg-amber-500/15 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
            Set <code className="text-xs">ADMIN_USERNAME</code> and{' '}
            <code className="text-xs">ADMIN_PASSWORD</code> in <code className="text-xs">.env.local</code>{' '}
            and restart the dev server.
          </p>
        ) : null}

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-[var(--home-muted)]">Username</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              className="w-full rounded-xl border border-[var(--home-card-border)] bg-[var(--app-surface)] px-3 py-2.5 text-sm text-[var(--app-text)] focus:outline-none focus:ring-2 focus:ring-[var(--home-sage-deep)]/30"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-[var(--home-muted)]">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full rounded-xl border border-[var(--home-card-border)] bg-[var(--app-surface)] px-3 py-2.5 text-sm text-[var(--app-text)] focus:outline-none focus:ring-2 focus:ring-[var(--home-sage-deep)]/30"
            />
          </label>
          {error ? (
            <p className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={loading || !configured}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--home-sage-deep)] py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            <Lock className="h-4 w-4" />
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
