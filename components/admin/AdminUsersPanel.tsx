'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Search, Users, X } from 'lucide-react'
import type { UserUsage } from '@/lib/admin'
import { cn } from '@/lib/cn'
import { Card, Empty, Pill, Table, button, field, formatNumber, timeAgo } from '@/components/admin/ui'

type Filter = 'all' | 'online' | 'registered' | 'guests'
type Sort = 'recent' | 'newest' | 'sessions' | 'name'

const PAGE = 25

const FILTERS: Array<[Filter, string]> = [
  ['all', 'All'],
  ['online', 'Online'],
  ['registered', 'Accounts'],
  ['guests', 'Guests'],
]

/**
 * Everyone who has opened the app (the 300 seen most recently): search, filter and sort them, and
 * open one to see when they came, how often, and which screens they use.
 */
export default function AdminUsersPanel({ users, initialQuery = '' }: { users: UserUsage[]; initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery)
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<Sort>('recent')
  const [page, setPage] = useState(0)
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => setQuery(initialQuery), [initialQuery])
  useEffect(() => setPage(0), [query, filter, sort])

  const counts = useMemo(
    () => ({
      all: users.length,
      online: users.filter((u) => u.isOnline).length,
      registered: users.filter((u) => u.userKind === 'registered').length,
      guests: users.filter((u) => u.userKind === 'guest').length,
    }),
    [users]
  )

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = users.filter((u) => {
      if (filter === 'online' && !u.isOnline) return false
      if (filter === 'registered' && u.userKind !== 'registered') return false
      if (filter === 'guests' && u.userKind !== 'guest') return false
      return !q || u.userName.toLowerCase().includes(q) || u.userId.toLowerCase().includes(q)
    })
    const by: Record<Sort, (a: UserUsage, b: UserUsage) => number> = {
      recent: (a, b) => b.lastSeenAt - a.lastSeenAt,
      newest: (a, b) => b.createdAt - a.createdAt,
      sessions: (a, b) => b.totalVisits - a.totalVisits,
      name: (a, b) => a.userName.localeCompare(b.userName),
    }
    return list.sort(by[sort])
  }, [users, query, filter, sort])

  const pages = Math.max(1, Math.ceil(shown.length / PAGE))
  const rows = shown.slice(page * PAGE, page * PAGE + PAGE)
  const open = users.find((u) => u.userId === openId) ?? null

  return (
    <>
      <Card padded={false}>
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--home-card-border)] px-4 py-3">
          <label className="relative min-w-[12rem] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--home-muted)]" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or id" className={cn(field, 'pl-9')} aria-label="Search users" />
          </label>
          <div className="flex rounded-lg border border-[var(--home-card-border)] p-0.5">
            {FILTERS.map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setFilter(id)}
                aria-pressed={filter === id}
                className={cn(
                  'rounded-md px-2.5 py-1 text-[0.78125rem] font-medium transition-colors',
                  filter === id ? 'bg-[var(--home-sage-soft)] text-[var(--home-sage-deep)]' : 'text-[var(--home-muted)] hover:text-[var(--home-heading)]'
                )}
              >
                {label} <span className="tabular-nums opacity-70">{counts[id]}</span>
              </button>
            ))}
          </div>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className={cn(field, 'w-auto py-1.5')} aria-label="Sort users">
            <option value="recent">Last active</option>
            <option value="newest">Newest</option>
            <option value="sessions">Most sessions</option>
            <option value="name">Name</option>
          </select>
        </div>

        {rows.length ? (
          <Table head={['Person', 'Type', 'Status', 'Sessions', 'Last screen', 'First seen']}>
            {rows.map((u) => (
              <tr key={u.userId} onClick={() => setOpenId(u.userId)} className="cursor-pointer hover:bg-[var(--app-surface)]">
                <td className="px-4 py-2.5">
                  <span className="block font-medium text-[var(--home-heading)]">{u.userName}</span>
                  <span className="block max-w-[14rem] truncate font-mono text-[0.6875rem] text-[var(--home-muted)]">{u.userId}</span>
                </td>
                <td className="px-4 py-2.5">{u.userKind === 'registered' ? <Pill tone="accent">Account</Pill> : <Pill>Guest</Pill>}</td>
                <td className="px-4 py-2.5">
                  <span className="flex items-center gap-1.5 whitespace-nowrap">
                    <span className={cn('h-2 w-2 rounded-full', u.isOnline ? 'bg-emerald-500' : 'bg-[var(--home-card-border)]')} aria-hidden />
                    <span className={u.isOnline ? 'font-medium text-emerald-600 dark:text-emerald-400' : 'text-[var(--home-muted)]'}>
                      {u.isOnline ? 'Online' : timeAgo(u.lastSeenAt)}
                    </span>
                  </span>
                </td>
                <td className="px-4 py-2.5 tabular-nums text-[var(--home-heading)]">{formatNumber(u.totalVisits)}</td>
                <td className="max-w-[10rem] truncate px-4 py-2.5 text-[var(--home-muted)]">{u.lastPath}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-[var(--home-muted)]">{timeAgo(u.createdAt)}</td>
              </tr>
            ))}
          </Table>
        ) : (
          <Empty icon={<Users className="h-7 w-7" />} title="No one matches">
            Try another name, or another filter.
          </Empty>
        )}

        <footer className="flex items-center justify-between gap-3 border-t border-[var(--home-card-border)] px-4 py-2.5 text-[0.78125rem] text-[var(--home-muted)]">
          <span>
            {shown.length ? `${page * PAGE + 1}–${Math.min(shown.length, page * PAGE + PAGE)} of ${formatNumber(shown.length)}` : '0 people'}
            <span className="hidden sm:inline"> · the 300 most recently active</span>
          </span>
          <span className="flex items-center gap-1">
            <button type="button" className={button.ghost} disabled={page === 0} onClick={() => setPage((p) => p - 1)} aria-label="Previous page">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="tabular-nums">
              {page + 1} / {pages}
            </span>
            <button type="button" className={button.ghost} disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)} aria-label="Next page">
              <ChevronRight className="h-4 w-4" />
            </button>
          </span>
        </footer>
      </Card>

      {open ? <UserDetails user={open} onClose={() => setOpenId(null)} /> : null}
    </>
  )
}

/** One person, in a panel from the side. */
function UserDetails({ user, onClose }: { user: UserUsage; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const views = Object.entries(user.pageViews ?? {})
    .filter(([path]) => !path.startsWith('/admin'))
    .sort((a, b) => b[1] - a[1])
  const total = views.reduce((sum, [, n]) => sum + n, 0) || 1

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={user.userName}>
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close" onClick={onClose} />
      <aside className="absolute inset-y-0 right-0 flex w-[min(26rem,100vw)] flex-col border-l border-[var(--home-card-border)] bg-[var(--home-card-bg)] shadow-2xl">
        <header className="flex items-start gap-3 border-b border-[var(--home-card-border)] px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[1rem] font-semibold text-[var(--home-heading)]">{user.userName}</p>
            <p className="mt-0.5 break-all font-mono text-[0.6875rem] text-[var(--home-muted)]">{user.userId}</p>
            <div className="mt-2 flex gap-1.5">
              {user.userKind === 'registered' ? <Pill tone="accent">Account</Pill> : <Pill>Guest</Pill>}
              {user.isOnline ? <Pill tone="good">Online</Pill> : <Pill>{user.presenceDetail}</Pill>}
            </div>
          </div>
          <button type="button" onClick={onClose} className={button.ghost} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <dl className="grid grid-cols-2 gap-3 text-[0.8125rem]">
            <Fact label="First seen" value={new Date(user.createdAt).toLocaleString()} />
            <Fact label="Last active" value={new Date(user.lastSeenAt).toLocaleString()} />
            <Fact label="Sessions" value={formatNumber(user.totalVisits)} />
            <Fact label="Last screen" value={user.lastPath} />
          </dl>
          <div>
            <p className="mb-2 text-[0.75rem] font-semibold uppercase tracking-wider text-[var(--home-muted)]">Screens used</p>
            {views.length ? (
              <ul className="space-y-2">
                {views.slice(0, 15).map(([path, n]) => (
                  <li key={path} className="grid grid-cols-[minmax(0,1fr)_5rem_2.5rem] items-center gap-2 text-[0.78125rem]">
                    <span className="truncate text-[var(--home-heading)]">{path}</span>
                    <span className="h-1.5 overflow-hidden rounded-full bg-[var(--app-surface)]">
                      <span className="block h-full rounded-full bg-[var(--home-sage-deep)]" style={{ width: `${Math.max(4, (n / total) * 100)}%` }} />
                    </span>
                    <span className="text-right tabular-nums text-[var(--home-muted)]">{n}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[0.8125rem] text-[var(--home-muted)]">No screen views recorded.</p>
            )}
          </div>
        </div>
      </aside>
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[var(--app-surface)] px-3 py-2">
      <dt className="text-[0.6875rem] text-[var(--home-muted)]">{label}</dt>
      <dd className="mt-0.5 truncate font-medium text-[var(--home-heading)]">{value}</dd>
    </div>
  )
}
