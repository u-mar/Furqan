'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, Search, SearchX, UsersRound, X } from 'lucide-react'
import EmptyState from '@/components/qari/EmptyState'
import FollowButton from '@/components/qari/FollowButton'
import QariAvatar from '@/components/qari/QariAvatar'
import { Notice, QariScreen, useNotice, useViewer } from '@/components/qari/QariShell'
import { fetchQaris, type QariSummary } from '@/lib/qari'
import { cn } from '@/lib/cn'

type Tab = 'all' | 'following'

/** Find qaris and follow them. */
export default function QarisPage() {
  const viewer = useViewer()
  const { notice, setNotice } = useNotice()
  const [tab, setTab] = useState<Tab>('all')
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<QariSummary[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const id = window.setTimeout(() => setQuery(search.trim()), 250)
    return () => window.clearTimeout(id)
  }, [search])

  const load = useCallback(async () => {
    setFailed(false)
    try {
      setItems(
        await fetchQaris({ viewerId: viewer?.id ?? null, query, onlyFollowing: tab === 'following' })
      )
    } catch {
      setFailed(true)
      setItems([])
    }
  }, [query, tab, viewer?.id])

  useEffect(() => {
    setItems(null)
    void load()
  }, [load])

  const me = viewer?.username.toLowerCase() ?? null

  return (
    <QariScreen>
      <header className="flex items-center gap-1">
        <Link
          href="/qari"
          aria-label="Back"
          className="qari-press ed-focus -ml-2 flex h-11 w-10 shrink-0 items-center justify-center text-[var(--home-heading)]"
        >
          <ChevronLeft className="h-6 w-6" strokeWidth={2} />
        </Link>
        <h1 className="text-xl font-bold tracking-[-0.01em] text-[var(--home-heading)]">Qaris</h1>
      </header>

      <div className="relative mt-3">
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-[var(--home-muted)]"
          strokeWidth={2}
          aria-hidden
        />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search qaris"
          aria-label="Search qaris"
          enterKeyHint="search"
          className="ed-focus h-[42px] w-full rounded-xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] pl-10 pr-9 text-sm text-[var(--home-heading)] placeholder:text-[var(--home-muted)]"
        />
        {search ? (
          <button
            type="button"
            onClick={() => setSearch('')}
            aria-label="Clear search"
            className="ed-focus absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-[var(--home-muted)] hover:text-[var(--home-heading)]"
          >
            <X className="h-4 w-4" strokeWidth={2.2} />
          </button>
        ) : null}
      </div>

      <div className="mt-4 flex gap-2" role="tablist" aria-label="Which qaris">
        {(
          [
            { id: 'all', label: 'All' },
            { id: 'following', label: 'Following' },
          ] as const
        ).map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              'qari-press ed-focus h-9 rounded-full px-4 text-sm font-semibold transition-colors',
              tab === id
                ? 'ed-ink font-bold'
                : 'border border-[var(--home-card-border)] bg-[var(--home-card-bg)] text-[var(--home-heading)]'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-3">
        {items === null ? (
          <div aria-hidden className="space-y-1">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 py-2" style={{ opacity: 1 - i * 0.18 }}>
                <span className="qari-skeleton h-12 w-12 rounded-full" />
                <span className="flex-1 space-y-2">
                  <span className="qari-skeleton block h-3.5 w-1/2 rounded-full" />
                  <span className="qari-skeleton block h-3 w-1/3 rounded-full" />
                </span>
                <span className="qari-skeleton h-[34px] w-20 rounded-full" />
              </div>
            ))}
          </div>
        ) : failed ? (
          <EmptyState Icon={UsersRound} title="Could not load qaris" body="Check your connection and try again." action={{ label: 'Try again', onClick: () => void load() }} />
        ) : items.length === 0 ? (
          tab === 'following' && !query ? (
            <EmptyState
              Icon={UsersRound}
              title={viewer ? 'You are not following anyone yet' : 'Sign in to follow qaris'}
              body="Follow qaris you like and you can hear their new recitations first."
              action={viewer ? { label: 'See all qaris', onClick: () => setTab('all') } : undefined}
            />
          ) : (
            <EmptyState Icon={SearchX} title="No qaris found" body={`Nobody matches “${query}”.`} />
          )
        ) : (
          <div>
            {items.map((qari, i) => {
              const isMe = me === qari.username.toLowerCase()
              return (
                <div
                  key={qari.username}
                  className="qari-enter flex items-center gap-3 py-2"
                  style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}
                >
                  <Link
                    href={`/qari/${encodeURIComponent(qari.username)}`}
                    className="ed-focus flex min-w-0 flex-1 items-center gap-3 rounded-2xl"
                  >
                    <QariAvatar username={qari.username} name={qari.name} size={48} />
                    <span className="min-w-0">
                      <span className="block truncate text-[15px] font-semibold text-[var(--home-heading)]">{qari.name}</span>
                      <span className="mt-0.5 block truncate text-[13px] text-[var(--home-muted)]">
                        @{qari.username} · {qari.recitations} {qari.recitations === 1 ? 'recitation' : 'recitations'}
                      </span>
                    </span>
                  </Link>
                  {isMe ? (
                    <span className="px-2 text-[13px] font-semibold text-[var(--home-muted)]">You</span>
                  ) : (
                    <FollowButton
                      viewer={viewer}
                      target={qari.username}
                      following={qari.following}
                      onNotice={setNotice}
                      onChange={({ following }) =>
                        setItems((prev) =>
                          prev?.map((q) => (q.username === qari.username ? { ...q, following } : q)) ?? prev
                        )
                      }
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <Notice message={notice} />
    </QariScreen>
  )
}
