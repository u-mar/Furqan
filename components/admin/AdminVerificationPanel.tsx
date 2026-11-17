'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { BadgeCheck, X } from 'lucide-react'
import { listVerification, setVerified, type Uploader, type VerificationRequest } from '@/lib/admin-api'

/**
 * Verified reciters: the applications sent from Qari profiles, to approve or turn down, and the
 * accounts that carry the badge, which can be added by @username or have it taken away.
 */
export default function AdminVerificationPanel() {
  const [requests, setRequests] = useState<VerificationRequest[] | null>(null)
  const [verified, setVerifiedList] = useState<Uploader[] | null>(null)
  const [username, setUsername] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    listVerification()
      .then((result) => {
        setRequests(result.requests)
        setVerifiedList(result.verified)
      })
      .catch(() => setError('Could not load the list.'))
  }, [])

  const decide = async (name: string, verify: boolean) => {
    setBusy(true)
    setError('')
    try {
      const account = await setVerified(name, verify)
      setRequests((list) => (list ?? []).filter((r) => r.username !== account.username))
      setVerifiedList((list) => {
        const others = (list ?? []).filter((u) => u.username !== account.username)
        return verify
          ? [...others, { username: account.username, name: account.name }].sort((a, b) => a.username.localeCompare(b.username))
          : others
      })
      if (verify) setUsername('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change that.')
    } finally {
      setBusy(false)
    }
  }

  const add = (event: FormEvent) => {
    event.preventDefault()
    if (username.trim()) void decide(username, true)
  }

  const cardClass =
    'rounded-2xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] p-4 shadow-[var(--home-card-shadow)]'

  return (
    <div className="space-y-4">
      {error ? <p className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">{error}</p> : null}

      <section className={cardClass}>
        <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-[var(--home-heading)]">Applications</h2>
          <p className="text-xs text-[var(--home-muted)]">{requests?.length ?? 0} waiting</p>
        </div>
        <p className="mb-4 text-xs leading-relaxed text-[var(--home-muted)]">
          Reciters who asked for the verified badge from their Qari profile. Listen to their recitations before approving.
        </p>
        {requests === null ? (
          <p className="py-4 text-center text-sm text-[var(--home-muted)]">Loading…</p>
        ) : requests.length === 0 ? (
          <p className="py-4 text-center text-sm text-[var(--home-muted)]">No applications.</p>
        ) : (
          <ul className="divide-y divide-[var(--home-card-border)]">
            {requests.map((r) => (
              <li key={r.username} className="py-3">
                <div className="flex items-start gap-3">
                  <a
                    href={`/qari/${encodeURIComponent(r.username)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="min-w-0 flex-1"
                  >
                    <span className="block truncate text-sm font-medium text-[var(--home-heading)]">{r.name}</span>
                    <span className="block truncate text-xs text-[var(--home-muted)]">
                      @{r.username}
                      {r.requestedAt ? ` · ${new Date(r.requestedAt).toLocaleDateString()}` : ''}
                    </span>
                  </a>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void decide(r.username, true)}
                    className="shrink-0 rounded-xl bg-[var(--home-sage-deep)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    Verify
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void decide(r.username, false)}
                    className="shrink-0 rounded-xl border border-[var(--home-card-border)] px-3 py-2 text-xs font-semibold text-[var(--home-heading)] disabled:opacity-50"
                  >
                    Decline
                  </button>
                </div>
                {r.note ? (
                  <p className="mt-2 whitespace-pre-line rounded-xl bg-[var(--app-surface)] px-3 py-2 text-sm leading-relaxed text-[var(--home-heading)]">
                    {r.note}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={cardClass}>
        <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-[var(--home-heading)]">Verified reciters</h2>
          <p className="text-xs text-[var(--home-muted)]">{verified?.length ?? 0} verified</p>
        </div>
        <p className="mb-4 text-xs leading-relaxed text-[var(--home-muted)]">
          These accounts show the verified badge on their profile. Add one by the @username on their profile.
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
            Verify
          </button>
        </form>

        {verified === null ? (
          <p className="py-4 text-center text-sm text-[var(--home-muted)]">Loading…</p>
        ) : verified.length === 0 ? (
          <p className="py-4 text-center text-sm text-[var(--home-muted)]">Nobody yet.</p>
        ) : (
          <ul className="divide-y divide-[var(--home-card-border)]">
            {verified.map((u) => (
              <li key={u.username} className="flex items-center gap-3 py-2.5">
                <BadgeCheck className="h-4 w-4 shrink-0 text-[#1d9bf0]" strokeWidth={2.2} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-[var(--home-heading)]">{u.name}</span>
                  <span className="block truncate text-xs text-[var(--home-muted)]">@{u.username}</span>
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void decide(u.username, false)}
                  aria-label={`Remove the badge from @${u.username}`}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--home-muted)] hover:text-[var(--home-heading)] disabled:opacity-50"
                >
                  <X className="h-4 w-4" strokeWidth={2.2} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
