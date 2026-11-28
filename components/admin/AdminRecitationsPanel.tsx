'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, ExternalLink, Eye, EyeOff, Mic, Search, Trash2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Card, Empty, Pill, Table, button, confirmAction, field, formatNumber, timeAgo } from '@/components/admin/ui'

type Filter = 'all' | 'public' | 'private' | 'reported'

interface Row {
  id: string
  kind: string
  title: string
  userName: string
  userUsername: string
  durationSec: number
  isPrivate: boolean
  likes: number
  plays: number
  reports: number
  createdAt: number
}

const FILTERS: Array<[Filter, string]> = [
  ['all', 'All'],
  ['public', 'Public'],
  ['private', 'Hidden'],
  ['reported', 'Reported'],
]

function duration(sec: number): string {
  if (!sec) return '—'
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}

/** Every Qari post, newest first: find one, hide it from everyone but its owner, or remove it. */
export default function AdminRecitationsPanel({ initialQuery = '', onChanged }: { initialQuery?: string; onChanged?: () => void }) {
  const [query, setQuery] = useState(initialQuery)
  const [debounced, setDebounced] = useState(initialQuery)
  const [filter, setFilter] = useState<Filter>('all')
  const [page, setPage] = useState(0)
  const [data, setData] = useState<{ total: number; pageSize: number; recitations: Row[] } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => setQuery(initialQuery), [initialQuery])
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [query])
  useEffect(() => setPage(0), [debounced, filter])

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/recitations?q=${encodeURIComponent(debounced)}&filter=${filter}&page=${page}`, { credentials: 'include', cache: 'no-store' })
      if (!res.ok) throw new Error()
      setData(await res.json())
    } catch {
      setError('Could not load the recitations.')
    }
  }, [debounced, filter, page])

  useEffect(() => {
    void load()
  }, [load])

  const act = async (row: Row, action: 'hide' | 'show' | 'remove') => {
    if (action === 'remove' && !confirmAction(`Remove “${row.title}” by ${row.userName}? Its audio, likes and reports are deleted. This cannot be undone.`)) return
    setBusy(row.id)
    setError('')
    try {
      const res = await fetch('/api/admin/recitations', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: row.id, action }),
      })
      if (!res.ok) throw new Error()
      await load()
      onChanged?.()
    } catch {
      setError('That did not work. Try again.')
    } finally {
      setBusy(null)
    }
  }

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1

  return (
    <Card padded={false}>
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--home-card-border)] px-4 py-3">
        <label className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--home-muted)]" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Title, reciter or @username" className={cn(field, 'pl-9')} aria-label="Search recitations" />
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
              {label}
            </button>
          ))}
        </div>
      </div>

      {error ? <p className="border-b border-[var(--home-card-border)] bg-red-500/10 px-4 py-2 text-[0.8125rem] text-red-600 dark:text-red-400">{error}</p> : null}

      {!data ? (
        <p className="px-4 py-10 text-center text-[0.8125rem] text-[var(--home-muted)]">Loading…</p>
      ) : data.recitations.length ? (
        <Table head={['Recitation', 'Reciter', 'Length', 'Plays', 'Likes', 'Status', 'Posted', '']}>
          {data.recitations.map((r) => (
            <tr key={r.id} className={cn(busy === r.id && 'opacity-50')}>
              <td className="max-w-[16rem] px-4 py-2.5">
                <span className="block truncate font-medium text-[var(--home-heading)]">{r.title}</span>
                <span className="text-[0.6875rem] capitalize text-[var(--home-muted)]">{r.kind}</span>
              </td>
              <td className="px-4 py-2.5">
                <span className="block truncate text-[var(--home-heading)]">{r.userName}</span>
                <span className="block truncate text-[0.6875rem] text-[var(--home-muted)]">@{r.userUsername}</span>
              </td>
              <td className="px-4 py-2.5 tabular-nums text-[var(--home-muted)]">{duration(r.durationSec)}</td>
              <td className="px-4 py-2.5 tabular-nums text-[var(--home-heading)]">{formatNumber(r.plays)}</td>
              <td className="px-4 py-2.5 tabular-nums text-[var(--home-heading)]">{formatNumber(r.likes)}</td>
              <td className="px-4 py-2.5">
                <span className="flex flex-wrap gap-1">
                  {r.isPrivate ? <Pill>Hidden</Pill> : <Pill tone="good">Public</Pill>}
                  {r.reports ? <Pill tone="warn">{r.reports} report{r.reports === 1 ? '' : 's'}</Pill> : null}
                </span>
              </td>
              <td className="whitespace-nowrap px-4 py-2.5 text-[var(--home-muted)]">{timeAgo(r.createdAt)}</td>
              <td className="px-4 py-2.5">
                <span className="flex justify-end gap-1">
                  <a href={`/qari/${encodeURIComponent(r.userUsername)}`} target="_blank" rel="noreferrer" className={button.ghost} aria-label="Open the reciter's profile" title="Open profile">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                  <button
                    type="button"
                    className={button.ghost}
                    disabled={busy === r.id}
                    onClick={() => void act(r, r.isPrivate ? 'show' : 'hide')}
                    aria-label={r.isPrivate ? 'Make public' : 'Hide'}
                    title={r.isPrivate ? 'Make public' : 'Hide from everyone but its owner'}
                  >
                    {r.isPrivate ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </button>
                  <button type="button" className={cn(button.ghost, 'hover:text-red-600')} disabled={busy === r.id} onClick={() => void act(r, 'remove')} aria-label="Remove" title="Remove for good">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </span>
              </td>
            </tr>
          ))}
        </Table>
      ) : (
        <Empty icon={<Mic className="h-7 w-7" />} title="No recitations here" />
      )}

      <footer className="flex items-center justify-between gap-3 border-t border-[var(--home-card-border)] px-4 py-2.5 text-[0.78125rem] text-[var(--home-muted)]">
        <span>{data ? `${formatNumber(data.total)} recitation${data.total === 1 ? '' : 's'}` : ''}</span>
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
  )
}
