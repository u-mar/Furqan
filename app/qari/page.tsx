'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, Clock, Mic, Search, Sparkles, UserRound, X } from 'lucide-react'
import RecitationCard from '@/components/qari/RecitationCard'
import QariAvatar from '@/components/qari/QariAvatar'
import { Notice, QariScreen, useNotice, useViewer } from '@/components/qari/QariShell'
import AccountSheet from '@/components/settings/AccountSheet'
import { fetchFeed, type FeedSort, type Recitation } from '@/lib/qari'
import { cn } from '@/lib/cn'

export default function QariFeedPage() {
  const viewer = useViewer()
  const { notice, setNotice } = useNotice()
  const [sort, setSort] = useState<FeedSort>('recent')
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<Recitation[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [failed, setFailed] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)

  /* Debounce so a query fires once the typing settles, not per keystroke. */
  useEffect(() => {
    const id = window.setTimeout(() => setQuery(search.trim()), 300)
    return () => window.clearTimeout(id)
  }, [search])

  const load = useCallback(async () => {
    setLoading(true)
    setFailed(false)
    try {
      const page = await fetchFeed({ sort, query, viewerId: viewer?.id ?? null })
      setItems(page.items)
      setHasMore(page.hasMore)
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [query, sort, viewer?.id])

  useEffect(() => {
    void load()
  }, [load])

  const loadMore = useCallback(async () => {
    setLoadingMore(true)
    try {
      const page = await fetchFeed({
        sort,
        query,
        viewerId: viewer?.id ?? null,
        skip: items.length,
      })
      setItems((prev) => [...prev, ...page.items])
      setHasMore(page.hasMore)
    } catch {
      setNotice('Could not load more.')
    } finally {
      setLoadingMore(false)
    }
  }, [items.length, query, setNotice, sort, viewer?.id])

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((r) => r.id !== id))
  }, [])

  const searching = query.length > 0

  return (
    <QariScreen>
      {/* Search leads — it is what this screen is for. Back and your own
          profile flank it so the row costs no extra height. */}
      <header className="mb-3 flex items-center gap-2">
        <Link
          href="/"
          aria-label="Back"
          className="ed-focus flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[var(--home-rule-strong)] text-[var(--home-heading)] transition-colors hover:bg-[var(--home-ink)] hover:text-[var(--home-ink-fg)] active:scale-95"
        >
          <ChevronLeft className="h-5 w-5" strokeWidth={1.75} />
        </Link>

        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[var(--home-muted)]"
            aria-hidden
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search a qari or a recitation"
            aria-label="Search recitations"
            className="ed-focus ed-card h-12 w-full rounded-full pl-11 pr-10 text-sm text-[var(--home-heading)] placeholder:text-[var(--home-muted)]"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Clear search"
              className="ed-focus absolute right-2.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-[var(--home-muted)] transition-colors hover:text-[var(--home-heading)]"
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </button>
          ) : null}
        </div>

        {viewer ? (
          <Link
            href={`/qari/${encodeURIComponent(viewer.username)}`}
            aria-label="Your profile"
            title={`@${viewer.username}`}
            className="ed-focus flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition-transform active:scale-95"
          >
            <QariAvatar username={viewer.username} name={viewer.name} size={48} />
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => setAccountOpen(true)}
            aria-label="Sign in"
            className="ed-focus flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[var(--home-rule-strong)] text-[var(--home-heading)] transition-colors hover:bg-[var(--home-track)]"
          >
            <UserRound className="h-[18px] w-[18px]" strokeWidth={2} />
          </button>
        )}
      </header>

      {/* Sort — irrelevant while searching, so it steps aside */}
      {!searching ? (
        <div className="ed-seg mb-4 grid-cols-2">
          {(
            [
              { id: 'recent' as const, label: 'Latest', Icon: Clock },
              { id: 'top' as const, label: 'Most loved', Icon: Sparkles },
            ]
          ).map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setSort(id)}
              aria-pressed={sort === id}
              className="ed-seg__item ed-focus flex min-h-[44px] items-center justify-center gap-1.5 text-sm font-semibold"
            >
              <Icon className="h-4 w-4" strokeWidth={2} />
              {label}
            </button>
          ))}
        </div>
      ) : (
        <p className="mb-3 px-1 text-xs text-[var(--home-muted)]">
          {loading
            ? 'Searching…'
            : `${items.length} result${items.length === 1 ? '' : 's'} for “${query}”`}
        </p>
      )}

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="ed-card h-[7.5rem] animate-pulse rounded-[1.5rem]" />
          ))}
        </div>
      ) : failed ? (
        <div className="ed-card rounded-[1.5rem] p-6 text-center">
          <p className="text-sm text-[var(--home-heading)]">Could not load recitations.</p>
          <button
            type="button"
            onClick={() => void load()}
            className="ed-focus mt-3 rounded-full border border-[var(--home-rule-strong)] px-4 py-2 text-xs font-semibold text-[var(--home-heading)]"
          >
            Try again
          </button>
        </div>
      ) : items.length === 0 ? (
        searching ? (
          <div className="ed-card rounded-[1.5rem] p-8 text-center">
            <p className="home-serif text-[1.2rem] font-semibold text-[var(--home-heading)]">
              Nothing found
            </p>
            <p className="mx-auto mt-1.5 max-w-[30ch] text-sm leading-relaxed text-[var(--home-muted)]">
              Nothing matches “{query}”.
            </p>
          </div>
        ) : (
          <div className="ed-card rounded-[1.5rem] p-8 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--home-sage-soft)] text-[var(--home-sage-deep)]">
              <Mic className="h-7 w-7" strokeWidth={1.8} />
            </span>
            <p className="home-serif mt-4 text-[1.25rem] font-semibold text-[var(--home-heading)]">
              No recitations yet
            </p>
            <p className="mx-auto mt-1.5 max-w-[28ch] text-sm leading-relaxed text-[var(--home-muted)]">
              Be the first. Record a few ayahs and share them with everyone here.
            </p>
            <Link
              href="/qari/record"
              className="ed-ink ed-focus mt-5 inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold"
            >
              <Mic className="h-4 w-4" strokeWidth={2} />
              Record the first one
            </Link>
          </div>
        )
      ) : (
        <>
          <div className="space-y-3">
            {items.map((recitation) => (
              <RecitationCard
                key={recitation.id}
                recitation={recitation}
                viewerId={viewer?.id ?? null}
                viewerUsername={viewer?.username ?? null}
                onRemoved={removeItem}
                onNotice={setNotice}
              />
            ))}
          </div>

          {hasMore ? (
            <button
              type="button"
              onClick={() => void loadMore()}
              disabled={loadingMore}
              className={cn(
                'ed-focus mt-4 h-12 w-full rounded-full border border-[var(--home-rule-strong)] text-sm font-semibold text-[var(--home-heading)] transition-colors hover:bg-[var(--home-track)]',
                loadingMore && 'opacity-60'
              )}
            >
              {loadingMore ? 'Loading…' : 'Show more'}
            </button>
          ) : null}
        </>
      )}

      {/* Recording is the point of the place, so it stays within thumb reach. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-30 mx-auto flex max-w-lg justify-end px-4">
        <Link
          href="/qari/record"
          aria-label="Record a recitation"
          className="ed-ink ed-focus qari-fab pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full transition-transform active:scale-95"
        >
          <Mic className="h-[21px] w-[21px]" strokeWidth={2} />
        </Link>
      </div>

      <AccountSheet open={accountOpen} onClose={() => setAccountOpen(false)} onSuccess={() => {}} />
      <Notice message={notice} />
    </QariScreen>
  )
}
