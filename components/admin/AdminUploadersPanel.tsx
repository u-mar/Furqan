'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import { listUploaders, setUploader, setUploadsOpen, type Uploader } from '@/lib/admin-api'

/** Who gets the Upload button on Qari's record screen: everyone, or the accounts added by their @username. */
export default function AdminUploadersPanel() {
  const [uploaders, setUploaders] = useState<Uploader[] | null>(null)
  const [open, setOpen] = useState<boolean | null>(null)
  const [username, setUsername] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    listUploaders()
      .then((result) => {
        setUploaders(result.uploaders)
        setOpen(result.open)
      })
      .catch(() => setError('Could not load the list.'))
  }, [])

  const toggleOpen = async () => {
    const next = !open
    setBusy(true)
    setError('')
    try {
      await setUploadsOpen(next)
      setOpen(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change that.')
    } finally {
      setBusy(false)
    }
  }

  const change = async (name: string, allowed: boolean) => {
    setBusy(true)
    setError('')
    try {
      const account = await setUploader(name, allowed)
      setUploaders((list) => {
        const others = (list ?? []).filter((u) => u.username !== account.username)
        return allowed ? [...others, account].sort((a, b) => a.username.localeCompare(b.username)) : others
      })
      if (allowed) setUsername('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change that.')
    } finally {
      setBusy(false)
    }
  }

  const add = (event: FormEvent) => {
    event.preventDefault()
    if (username.trim()) void change(username, true)
  }

  const cardClass =
    'rounded-2xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] p-4 shadow-[var(--home-card-shadow)]'

  return (
    <div className="space-y-4">
      <section className={`${cardClass} flex items-center justify-between gap-4`}>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-[var(--home-heading)]">Open uploads to everyone</h2>
          <p className="mt-0.5 text-xs leading-relaxed text-[var(--home-muted)]">
            {open ? 'Every account has the Upload button.' : 'Only the accounts you add below have the Upload button.'}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={open === true}
          aria-label="Open uploads to everyone"
          disabled={busy || open === null}
          onClick={() => void toggleOpen()}
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 ${open ? 'bg-[var(--home-sage-deep)]' : 'bg-[var(--home-track)]'}`}
        >
          <span className={`absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white transition-transform ${open ? 'translate-x-5' : ''}`} />
        </button>
      </section>

      {error && open !== false ? <p className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">{error}</p> : null}

      {open === false ? (
          <section className={cardClass}>
            <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-[var(--home-heading)]">Who can upload recordings</h2>
              <p className="text-xs text-[var(--home-muted)]">{uploaders?.length ?? 0} approved</p>
            </div>
            <p className="mb-4 text-xs leading-relaxed text-[var(--home-muted)]">
              These accounts get an Upload button on the record screen, for recordings made outside the app. Add each qari by
              the @username on their profile.
            </p>

            <form onSubmit={add} className="mb-3 flex gap-2">
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="@username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                aria-label="Username"
                className="min-w-0 flex-1 rounded-xl border border-[var(--home-card-border)] bg-[var(--app-surface)] px-3 py-2.5 text-sm text-[var(--app-text)] focus:outline-none focus:ring-2 focus:ring-[var(--home-sage-deep)]/30"
              />
              <button
                type="submit"
                disabled={busy || !username.trim()}
                className="shrink-0 rounded-xl bg-[var(--home-sage-deep)] px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                Add
              </button>
            </form>

            {error ? <p className="mb-3 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">{error}</p> : null}

            {uploaders === null ? (
              <p className="py-4 text-center text-sm text-[var(--home-muted)]">Loading…</p>
            ) : uploaders.length === 0 ? (
              <p className="py-4 text-center text-sm text-[var(--home-muted)]">Nobody yet.</p>
            ) : (
              <ul className="divide-y divide-[var(--home-card-border)]">
                {uploaders.map((u) => (
                  <li key={u.username} className="flex items-center gap-3 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-[var(--home-heading)]">{u.name}</span>
                      <span className="block truncate text-xs text-[var(--home-muted)]">@{u.username}</span>
                    </span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void change(u.username, false)}
                      aria-label={`Remove @${u.username}`}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--home-muted)] hover:text-[var(--home-heading)] disabled:opacity-50"
                    >
                      <X className="h-4 w-4" strokeWidth={2.2} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
      ) : null}
    </div>
  )
}
