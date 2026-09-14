'use client'

import Link from 'next/link'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { ChevronLeft, Clock, Heart, Mic, RotateCw, Search, SearchX, Sparkles, Users, UsersRound, X } from 'lucide-react'
import Dropdown from '@/components/qari/Dropdown'
import EmptyState from '@/components/qari/EmptyState'
import LovedCard from '@/components/qari/LovedCard'
import { PullIndicator, usePullToRefresh } from '@/components/qari/PullToRefresh'
import RecitationRow from '@/components/qari/RecitationRow'
import SectionHeader from '@/components/qari/SectionHeader'
import { SheikhCard, SheikhHeader } from '@/components/qari/SheikhCards'
import SkeletonRows from '@/components/qari/SkeletonRows'
import { Notice, QariScreen, useNotice, useViewer } from '@/components/qari/QariShell'
import {
  fetchDiscover,
  fetchFeed,
  fetchSheikhStats,
  type Discover,
  type Recitation,
} from '@/lib/qari'
import { onPlayerError, stopPlayback } from '@/lib/qari-player'
import { findSheikh, matchSheikh } from '@/lib/sheikhs'
import type { AppUser } from '@/lib/auth'

type Sort = 'recent' | 'top' | 'following'

function QariHomeContent() {
  const viewer = useViewer()
  const { notice, setNotice } = useNotice()
  const params = useSearchParams()
  const urlQuery = params.get('q') ?? ''

  const [search, setSearch] = useState(urlQuery)
  const [query, setQuery] = useState(urlQuery)
  const [sort, setSort] = useState<Sort>('recent')

  const [discover, setDiscover] = useState<Discover | null>(null)
  const [items, setItems] = useState<Recitation[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  // Tapping a hashtag anywhere lands here as ?q=%23tag, even from this page.
  useEffect(() => {
    setSearch(urlQuery)
    setQuery(urlQuery)
  }, [urlQuery])

  /* Search fires once the typing settles, not on every key. */
  useEffect(() => {
    const id = window.setTimeout(() => setQuery(search.trim()), 300)
    return () => window.clearTimeout(id)
  }, [search])

  useEffect(() => onPlayerError(setNotice), [setNotice])

  const viewerId = viewer?.id ?? null
  const searching = query.length > 0

  // Searching swaps the whole list out, taking the playing row with it.
  const wasSearching = useRef(searching)
  useEffect(() => {
    if (wasSearching.current !== searching) stopPlayback()
    wasSearching.current = searching
  }, [searching])

  const loadDiscover = useCallback(async () => {
    try {
      setDiscover(await fetchDiscover(viewerId))
    } catch {
      setDiscover((prev) => prev ?? { tags: [], sheikhs: [], mostLoved: [] })
    }
  }, [viewerId])

  const loadFeed = useCallback(async () => {
    setFailed(false)
    try {
      const page = await fetchFeed({
        sort: sort === 'top' ? 'top' : 'recent',
        following: sort === 'following',
        viewerId,
      })
      setItems(page.items)
      setHasMore(page.hasMore)
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [sort, viewerId])

  useEffect(() => {
    if (searching) return
    void loadDiscover()
  }, [loadDiscover, searching])

  useEffect(() => {
    if (searching) return
    setLoading(true)
    void loadFeed()
  }, [loadFeed, searching])

  const { pull, refreshing } = usePullToRefresh(() => Promise.all([loadDiscover(), loadFeed()]))

  const loadMore = useCallback(async () => {
    setLoadingMore(true)
    try {
      const page = await fetchFeed({
        sort: sort === 'top' ? 'top' : 'recent',
        following: sort === 'following',
        viewerId,
        skip: items.length,
      })
      setItems((prev) => [...prev, ...page.items])
      setHasMore(page.hasMore)
    } catch {
      setNotice('Could not load more.')
    } finally {
      setLoadingMore(false)
    }
  }, [items.length, setNotice, sort, viewerId])

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((r) => r.id !== id))
  }, [])

  const sheikhs = useMemo(
    () =>
      (discover?.sheikhs ?? [])
        .map((s) => ({ sheikh: findSheikh(s.id), count: s.count }))
        .filter((s): s is { sheikh: NonNullable<ReturnType<typeof findSheikh>>; count: number } => Boolean(s.sheikh)),
    [discover]
  )

  const sortOptions = useMemo(
    () => [
      { id: 'recent' as const, label: 'Latest', Icon: Clock },
      { id: 'top' as const, label: 'Most loved', Icon: Sparkles },
      ...(viewer ? [{ id: 'following' as const, label: 'Following', Icon: UsersRound }] : []),
    ],
    [viewer]
  )

  return (
    <QariScreen>
      <PullIndicator pull={pull} refreshing={refreshing} />

      {/* Search leads — with the way to find people right beside it. */}
      <header className="flex items-center gap-2">
        <Link
          href="/"
          aria-label="Back"
          className="qari-press ed-focus -ml-2 flex h-11 w-10 shrink-0 items-center justify-center text-[var(--home-heading)]"
        >
          <ChevronLeft className="h-6 w-6" strokeWidth={2} />
        </Link>
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-[var(--home-muted)]"
            strokeWidth={2}
            aria-hidden
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search a qari or a recitation"
            aria-label="Search recitations"
            enterKeyHint="search"
            className="ed-focus h-[42px] w-full rounded-xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] pl-10 pr-9 text-sm text-[var(--home-heading)] placeholder:text-[var(--home-muted)]"
          />
          {search ? (
            <button
              type="button"
              onClick={() => {
                setSearch('')
                setQuery('')
              }}
              aria-label="Clear search"
              className="ed-focus absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-[var(--home-muted)] hover:text-[var(--home-heading)]"
            >
              <X className="h-4 w-4" strokeWidth={2.2} />
            </button>
          ) : null}
        </div>
        <Link
          href="/qari/qaris"
          aria-label="Qaris"
          className="qari-press ed-focus flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] text-[var(--home-heading)]"
        >
          <Users className="h-[19px] w-[19px]" strokeWidth={2} />
        </Link>
      </header>

      {searching ? (
        <SearchResults key={query} query={query} viewer={viewer} onNotice={setNotice} />
      ) : (
        <>
          {discover && discover.tags.length > 0 ? (
            <div className="qari-no-scrollbar -mx-5 mt-3 flex gap-2 overflow-x-auto px-5">
              {discover.tags.map(({ tag }) => (
                <Link
                  key={tag}
                  href={`/qari?q=${encodeURIComponent(`#${tag}`)}`}
                  className="qari-press ed-focus flex h-8 shrink-0 items-center rounded-full border border-[var(--home-card-border)] bg-[var(--home-card-bg)] px-3 text-[13px] font-semibold text-[var(--home-heading)]"
                >
                  <span className="text-[var(--home-sage)]">#</span>
                  {tag}
                </Link>
              ))}
            </div>
          ) : null}

          {sheikhs.length > 0 ? (
            <section>
              <SectionHeader
                first
                title="Popular imitations"
                action={
                  <Link href="/qari/sheikhs" className="ed-focus text-[13px] font-semibold text-[var(--home-sage)]">
                    See all
                  </Link>
                }
              />
              {sheikhs.length <= 2 ? (
                <div className="flex gap-2.5">
                  {sheikhs.map(({ sheikh, count }, i) => (
                    <SheikhCard key={sheikh.id} sheikh={sheikh} count={count} index={i} fill />
                  ))}
                </div>
              ) : (
                <div className="qari-no-scrollbar -mx-5 flex snap-x scroll-px-5 gap-2.5 overflow-x-auto px-5">
                  {sheikhs.map(({ sheikh, count }, i) => (
                    <SheikhCard key={sheikh.id} sheikh={sheikh} count={count} index={i} />
                  ))}
                </div>
              )}
            </section>
          ) : null}

          {discover && discover.mostLoved.length > 0 ? (
            <section>
              <SectionHeader
                first={sheikhs.length === 0}
                title="Most loved"
                action={
                  <button
                    type="button"
                    onClick={() => {
                      setSort('top')
                      document.getElementById('all-recitations')?.scrollIntoView({ behavior: 'smooth' })
                    }}
                    className="ed-focus text-[13px] font-semibold text-[var(--home-sage)]"
                  >
                    See all
                  </button>
                }
              />
              <div className="qari-no-scrollbar -mx-5 flex snap-x scroll-px-5 gap-2.5 overflow-x-auto px-5 pb-1">
                {discover.mostLoved.map((recitation, i) => (
                  <LovedCard
                    key={recitation.id}
                    recitation={recitation}
                    queue={discover.mostLoved}
                    viewerId={viewerId}
                    index={i}
                    onNotice={setNotice}
                  />
                ))}
              </div>
            </section>
          ) : null}

          <section id="all-recitations" className="scroll-mt-4">
            <SectionHeader
              first={sheikhs.length === 0 && !(discover && discover.mostLoved.length > 0)}
              title={sort === 'following' ? 'Following' : 'All recitations'}
              action={<Dropdown label="Sort" value={sort} options={sortOptions} onChange={setSort} />}
            />

            {loading ? (
              <SkeletonRows />
            ) : failed ? (
              <EmptyState
                Icon={RotateCw}
                title="Could not load recitations"
                body="Check your connection and try again."
                action={{ label: 'Try again', onClick: () => void loadFeed(), Icon: RotateCw }}
              />
            ) : items.length === 0 ? (
              sort === 'following' ? (
                <EmptyState
                  Icon={UsersRound}
                  title="Nothing from people you follow"
                  body="Follow qaris you like and their new recitations will show up here."
                  action={{ label: 'Find qaris', href: '/qari/qaris', Icon: Users }}
                />
              ) : (
                <EmptyState
                  Icon={Mic}
                  title="No recitations yet"
                  body="Be the first. Record a few ayahs and share them with everyone here."
                  action={{ label: 'Record the first one', href: '/qari/record', Icon: Mic }}
                />
              )
            ) : (
              <>
                <div>
                  {items.map((recitation, i) => (
                    <RecitationRow
                      key={recitation.id}
                      recitation={recitation}
                      queue={items}
                      index={i}
                      viewerId={viewerId}
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
                    className="qari-press ed-focus mt-4 h-11 w-full rounded-full border border-[var(--home-rule-strong)] text-sm font-semibold text-[var(--home-heading)] transition-colors hover:bg-[var(--home-track)] disabled:opacity-60"
                  >
                    {loadingMore ? 'Loading…' : 'Show more'}
                  </button>
                ) : null}
              </>
            )}
          </section>
        </>
      )}

      <Notice message={notice} />
    </QariScreen>
  )
}

/** A search: a sheikh's imitations first when the query names one, then everything else it matches. */
function SearchResults({
  query,
  viewer,
  onNotice,
}: {
  query: string
  viewer: AppUser | null
  onNotice: (message: string) => void
}) {
  const sheikh = useMemo(() => matchSheikh(query), [query])
  const viewerId = viewer?.id ?? null
  const [sort, setSort] = useState<'recent' | 'top'>('top')
  const [imitations, setImitations] = useState<Recitation[] | null>(null)
  const [stats, setStats] = useState<{ count: number; people: number } | null>(null)
  const [results, setResults] = useState<Recitation[] | null>(null)

  useEffect(() => {
    let cancelled = false
    setResults(null)
    fetchFeed({ query, viewerId, take: 40 })
      .then((page) => !cancelled && setResults(page.items))
      .catch(() => !cancelled && setResults([]))
    return () => {
      cancelled = true
    }
  }, [query, viewerId])

  useEffect(() => {
    if (!sheikh) return
    let cancelled = false
    setImitations(null)
    fetchFeed({ imitating: sheikh.id, sort, viewerId, take: 40 })
      .then((page) => !cancelled && setImitations(page.items))
      .catch(() => !cancelled && setImitations([]))
    return () => {
      cancelled = true
    }
  }, [sheikh, sort, viewerId])

  useEffect(() => {
    if (!sheikh) return
    let cancelled = false
    fetchSheikhStats(sheikh.id).then((s) => !cancelled && setStats(s))
    return () => {
      cancelled = true
    }
  }, [sheikh])

  const others = useMemo(
    () => (results && sheikh ? results.filter((r) => r.imitating !== sheikh.id) : results),
    [results, sheikh]
  )

  const row = (list: Recitation[]) => (r: Recitation, i: number) => (
    <RecitationRow
      key={r.id}
      recitation={r}
      queue={list}
      index={i}
      viewerId={viewerId}
      viewerUsername={viewer?.username ?? null}
      onNotice={onNotice}
      onRemoved={(id) => {
        setResults((prev) => prev?.filter((x) => x.id !== id) ?? prev)
        setImitations((prev) => prev?.filter((x) => x.id !== id) ?? prev)
      }}
    />
  )

  return (
    <div className="mt-4">
      {sheikh ? (
        <>
          <SheikhHeader sheikh={sheikh} count={stats?.count ?? null} people={stats?.people ?? null} />
          <SectionHeader
            title="Imitations"
            action={
              <Dropdown
                label="Sort"
                value={sort}
                onChange={setSort}
                options={[
                  { id: 'top', label: 'Most loved', Icon: Heart },
                  { id: 'recent', label: 'Latest', Icon: Clock },
                ]}
              />
            }
          />
          {imitations === null ? (
            <SkeletonRows count={3} />
          ) : imitations.length === 0 ? (
            <p className="qari-enter rounded-2xl bg-[var(--home-track)] px-4 py-3.5 text-sm leading-relaxed text-[var(--home-muted)]">
              No one has imitated {sheikh.shortName} yet. Be the first.
            </p>
          ) : (
            <div>{imitations.map(row(imitations))}</div>
          )}
        </>
      ) : null}

      {others === null ? (
        sheikh ? null : <SkeletonRows count={4} />
      ) : others.length > 0 ? (
        <>
          <SectionHeader first={!sheikh} title={sheikh ? 'More results' : `Results for “${query}”`} />
          <div>{others.map(row(others))}</div>
        </>
      ) : !sheikh ? (
        <EmptyState Icon={SearchX} title="Nothing found" body={`Nothing matches “${query}”. Try a qari's name, a title or a #tag.`} />
      ) : null}
    </div>
  )
}

export default function QariHomePage() {
  return (
    <Suspense fallback={<QariScreen>{null}</QariScreen>}>
      <QariHomeContent />
    </Suspense>
  )
}
