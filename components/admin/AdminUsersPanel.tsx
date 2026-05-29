'use client'

import { useMemo, useState } from 'react'
import { cn } from '@/lib/cn'
import type { UserUsage } from '@/lib/admin'

type UserFilter = 'all' | 'registered' | 'guests' | 'online' | 'offline'

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString()
}

export default function AdminUsersPanel({ users }: { users: UserUsage[] }) {
  const [filter, setFilter] = useState<UserFilter>('all')

  const filtered = useMemo(() => {
    return users.filter((user) => {
      if (filter === 'registered') return user.userKind === 'registered'
      if (filter === 'guests') return user.userKind === 'guest'
      if (filter === 'online') return user.isOnline
      if (filter === 'offline') return !user.isOnline
      return true
    })
  }, [filter, users])

  const tabs: { id: UserFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'registered', label: 'Registered' },
    { id: 'guests', label: 'Guests' },
    { id: 'online', label: 'Online' },
    { id: 'offline', label: 'Offline' },
  ]

  return (
    <section className="rounded-2xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] p-4 shadow-[var(--home-card-shadow)]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-[var(--home-heading)]">Users & presence</h2>
        <p className="text-xs text-[var(--home-muted)]">{filtered.length} shown</p>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilter(tab.id)}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors',
              filter === tab.id
                ? 'bg-[var(--home-sage-deep)] text-white'
                : 'bg-[var(--app-surface)] text-[var(--home-muted)] hover:text-[var(--home-heading)]'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="max-h-[min(65vh,32rem)] space-y-2 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="text-sm text-[var(--home-muted)]">No users in this filter.</p>
        ) : (
          filtered.map((user) => (
            <article
              key={user.userId}
              className="rounded-xl border border-[var(--home-card-border)] bg-[var(--app-surface)]/50 p-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-[var(--home-heading)]">
                      {user.userName}
                    </p>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                        user.userKind === 'registered'
                          ? 'bg-teal-500/15 text-teal-700 dark:text-teal-300'
                          : 'bg-stone-500/15 text-stone-600 dark:text-stone-300'
                      )}
                    >
                      {user.userKind === 'registered' ? 'Registered' : 'Guest'}
                    </span>
                  </div>
                  <p className="mt-0.5 font-mono text-[10px] text-[var(--home-muted)]">
                    {user.userId}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={cn(
                      'h-2 w-2 rounded-full',
                      user.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-stone-400'
                    )}
                    aria-hidden
                  />
                  <span
                    className={cn(
                      'text-xs font-semibold',
                      user.isOnline ? 'text-emerald-600 dark:text-emerald-400' : 'text-[var(--home-muted)]'
                    )}
                  >
                    {user.presenceLabel}
                  </span>
                </div>
              </div>
              <p className="mt-2 text-xs text-[var(--home-muted)]">{user.presenceDetail}</p>
              <p className="mt-1 text-xs text-[var(--home-muted)]">
                {user.totalVisits} session{user.totalVisits === 1 ? '' : 's'} · Last page:{' '}
                <span className="text-[var(--app-text)]">{user.lastPath}</span>
              </p>
              <p className="mt-0.5 text-[10px] text-[var(--home-muted)]">
                First seen {formatTime(user.createdAt)} · Last active {formatTime(user.lastSeenAt)}
              </p>
            </article>
          ))
        )}
      </div>
    </section>
  )
}
