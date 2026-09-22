'use client'

import Link from 'next/link'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2, Mic, RotateCw, SearchX, UserRound, Users, UsersRound } from 'lucide-react'
import EmptyState from '@/components/qari/EmptyState'
import NotificationsBell from '@/components/qari/NotificationsBell'
import QariAvatar from '@/components/qari/QariAvatar'
import { PullIndicator, usePullToRefresh } from '@/components/qari/PullToRefresh'
import RecitationCard, { RecitationCards, RecitationSkeletons } from '@/components/qari/RecitationCard'
import { SheikhCard, SheikhHeader } from '@/components/qari/SheikhCards'
import {
  QariHeader,
  QariLabel,
  QariScreen,
  QariSearch,
  QariSegmented,
  qariNotice,
  useViewer,
} from '@/components/qari/QariShell'
import { fetchDiscover, fetchFeed, fetchSheikhStats, peekDiscover, peekFeed, type Discover, type Recitation } from '@/lib/qari'
import { onPlayerError, stopPlayback } from '@/lib/qari-player'
import { findSheikh, matchSheikh, type Sheikh } from '@/lib/sheikhs'
import { askToSignIn } from '@/lib/account-prompt'
import { tapFeedback } from '@/lib/haptics'
import type { AppUser } from '@/lib/auth'
import { tr, useT } from '@/lib/i18n'

type Sort = 'recent' | 'top' | 'following'

function QariHomeContent() {
  const t = useT()
  const viewer = useViewer()
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
  const loads = useRef(0)

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

  useEffect(() => onPlayerError(qariNotice), [])

  const viewerId = viewer?.id ?? null
  const searching = query.length > 0

  // Searching swaps the whole list out, taking the playing card with it.
  const wasSearching = useRef(searching)
  useEffect(() => {
    if (wasSearching.current !== searching) stopPlayback()
    wasSearching.current = searching
  }, [searching])

  const loadDiscover = useCallback(async () => {
    try {
      setDiscover(await fetchDiscover())
    } catch {
      setDiscover((prev) => prev ?? { tags: [], sheikhs: [], lovedQaris: [] })
    }
  }, [])

  const loadFeed = useCallback(async () => {
    const load = ++loads.current
    setFailed(false)
    try {
      const page = await fetchFeed({
        sort: sort === 'top' ? 'top' : 'recent',
        following: sort === 'following',
        viewerId,
      })
      if (load !== loads.current) return
      setItems(page.items)
      setHasMore(page.hasMore)
    } catch {
      if (load === loads.current) setFailed(true)
    } finally {
      if (load === loads.current) setLoading(false)
    }
  }, [sort, viewerId])

  useEffect(() => {
    if (searching) return
    // Open on what was seen last; the server then brings it up to date.
    const remembered = peekDiscover()
    if (remembered) setDiscover((prev) => prev ?? remembered)
    void loadDiscover()
  }, [loadDiscover, searching])

  useEffect(() => {
    if (searching) return
    const remembered = peekFeed({ sort: sort === 'top' ? 'top' : 'recent', following: sort === 'following', viewerId })
    if (remembered) {
      setItems(remembered.items)
      setHasMore(remembered.hasMore)
      setLoading(false)
    } else {
      setLoading(true)
    }
    void loadFeed()
  }, [loadFeed, searching])

  const { pull, refreshing } = usePullToRefresh(() => Promise.all([loadDiscover(), loadFeed()]))

  const loadMore = useCallback(async () => {
    tapFeedback()
    setLoadingMore(true)
    const load = loads.current
    try {
      const page = await fetchFeed({
        sort: sort === 'top' ? 'top' : 'recent',
        following: sort === 'following',
        viewerId,
        skip: items.length,
      })
      if (load !== loads.current) return
      setItems((prev) => [...prev, ...page.items.filter((r) => !prev.some((p) => p.id === r.id))])
      setHasMore(page.hasMore)
    } catch {
      qariNotice(tr('Could not load more.'))
    } finally {
      setLoadingMore(false)
    }
  }, [items.length, sort, viewerId])

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((r) => r.id !== id))
  }, [])

  // This feed is what everyone sees, so a recitation made private drops out of it.
  const onPrivacyChanged = useCallback(
    (id: string, patch: Partial<Recitation>) => {
      if (patch.isPrivate) removeItem(id)
    },
    [removeItem]
  )

  const sheikhs = useMemo(
    () =>
      (discover?.sheikhs ?? [])
        .map((s) => ({ sheikh: findSheikh(s.id), count: s.count }))
        .filter((s): s is { sheikh: Sheikh; count: number } => Boolean(s.sheikh)),
    [discover]
  )

  const sortOptions = useMemo(
    () => [
      { id: 'recent' as const, label: t('Latest') },
      { id: 'top' as const, label: t('Most loved') },
      ...(viewer ? [{ id: 'following' as const, label: t('Following') }] : []),
    ],
    [viewer, t]
  )

  return (
    <QariScreen>
      <PullIndicator pull={pull} refreshing={refreshing} />

      <QariHeader
        title={t('Qari')}
        backHref="/"
        action={
          <div className="flex items-center gap-2">
            <NotificationsBell />
            <Link href="/qari/qaris" onClick={tapFeedback} className="home-round ed-focus" aria-label={t('Qaris')}>
              <Users className="h-[19px] w-[19px]" strokeWidth={1.9} />
            </Link>
            {viewer ? (
              <Link
                href={`/qari/${encodeURIComponent(viewer.username)}`}
                onClick={tapFeedback}
                className="home-round ed-focus"
                aria-label={t('Your profile')}
              >
                <UserRound className="h-[19px] w-[19px]" strokeWidth={1.9} />
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => {
                  tapFeedback()
                  askToSignIn()
                }}
                className="home-round ed-focus"
                aria-label={t('Sign in')}
              >
                <UserRound className="h-[19px] w-[19px]" strokeWidth={1.9} />
              </button>
            )}
          </div>
        }
      />

      <QariSearch
        className="mt-3.5"
        value={search}
        onChange={(value) => {
          setSearch(value)
          if (!value) setQuery('')
        }}
        placeholder={t('Search a qari, recitation or #tag')}
        label={t('Search recitations')}
      />

      {searching ? (
        <SearchResults key={query} query={query} viewer={viewer} />
      ) : (
        <>
          {discover && discover.tags.length > 0 ? (
            <div className="qari-no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 pt-0.5">
              {discover.tags.map(({ tag }, i) => (
                <Link
                  key={tag}
                  href={`/qari?q=${encodeURIComponent(`#${tag}`)}`}
                  onClick={tapFeedback}
                  className="qari-enter qari-press ed-focus flex h-8 shrink-0 items-center rounded-full bg-[var(--home-card-bg)] px-3 text-[13px] font-semibold text-[var(--home-heading)] shadow-[var(--home-lift-sm)]"
                  style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}
                >
                  <span className="text-[var(--home-sage)]">#</span>
                  {tag}
                </Link>
              ))}
            </div>
          ) : null}

          {sheikhs.length > 0 ? (
            <section>
              <QariLabel action={<SeeAll href="/qari/sheikhs" />}>{t('Imitations')}</QariLabel>
              {sheikhs.length <= 2 ? (
                <div className="flex gap-2.5">
                  {sheikhs.map(({ sheikh, count }, i) => (
                    <SheikhCard key={sheikh.id} sheikh={sheikh} count={count} index={i} fill />
                  ))}
                </div>
              ) : (
                <div className="qari-no-scrollbar -mx-4 flex snap-x scroll-px-4 gap-2.5 overflow-x-auto px-4 pb-1.5 pt-0.5">
                  {sheikhs.map(({ sheikh, count }, i) => (
                    <SheikhCard key={sheikh.id} sheikh={sheikh} count={count} index={i} />
                  ))}
                </div>
              )}
            </section>
          ) : null}

          {discover && discover.lovedQaris.length > 0 ? (
            <section>
              <QariLabel action={<SeeAll href="/qari/qaris" />}>{t('Most loved qaris')}</QariLabel>
              <div className="qari-no-scrollbar -mx-4 flex snap-x scroll-px-4 gap-1 overflow-x-auto px-4 pb-1">
                {discover.lovedQaris.map((qari, i) => (
                  <Link
                    key={qari.username}
                    href={`/qari/${encodeURIComponent(qari.username)}`}
                    onClick={tapFeedback}
                    className="qari-enter qari-press ed-focus flex w-[68px] shrink-0 snap-start flex-col items-center gap-[7px] rounded-2xl py-0.5"
                    style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}
                  >
                    <QariAvatar username={qari.username} name={qari.name} size={56} />
                    <span className="w-full truncate text-center text-xs font-medium text-[var(--home-muted)]">
                      {qari.name.split(' ')[0]}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          <section id="all-recitations" className="scroll-mt-4">
            <QariLabel>{t('Recitations')}</QariLabel>
            <QariSegmented label={t('Sort recitations')} options={sortOptions} value={sort} onChange={setSort} />

            <div className="mt-3">
              {loading ? (
                <RecitationSkeletons />
              ) : failed ? (
                <EmptyState
                  Icon={RotateCw}
                  title={t('Could not load recitations')}
                  body={t('Check your connection and try again.')}
                  action={{ label: t('Try again'), onClick: () => void loadFeed(), Icon: RotateCw }}
                />
              ) : items.length === 0 ? (
                sort === 'following' ? (
                  <EmptyState
                    Icon={UsersRound}
                    title={t('Nothing from people you follow')}
                    body={t('Follow qaris you like and their new recitations will show up here.')}
                    action={{ label: t('Find qaris'), href: '/qari/qaris', Icon: Users }}
                  />
                ) : (
                  <EmptyState
                    Icon={Mic}
                    title={t('No recitations yet')}
                    body={t('Be the first. Record a few ayahs and share them with everyone here.')}
                    action={{ label: t('Record the first one'), href: '/qari/record', Icon: Mic }}
                  />
                )
              ) : (
                <>
                  <RecitationCards>
                    {items.map((recitation, i) => (
                      <RecitationCard
                        key={recitation.id}
                        recitation={recitation}
                        queue={items}
                        index={i}
                        viewerId={viewerId}
                        viewerUsername={viewer?.username ?? null}
                        onRemoved={removeItem}
                        onUpdated={onPrivacyChanged}
                        onNotice={qariNotice}
                      />
                    ))}
                  </RecitationCards>
                  {hasMore ? (
                    <button
                      type="button"
                      onClick={() => void loadMore()}
                      disabled={loadingMore}
                      className="qari-press ed-focus mt-3.5 flex h-11 w-full items-center justify-center gap-2 rounded-full border border-[var(--home-rule-strong)] text-sm font-semibold text-[var(--home-heading)] transition-colors hover:bg-[var(--home-track)] disabled:opacity-70"
                    >
                      {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.2} /> : null}
                      {loadingMore ? t('Loading') : t('Show more')}
                    </button>
                  ) : null}
                </>
              )}
            </div>
          </section>
        </>
      )}
    </QariScreen>
  )
}

function SeeAll({ href }: { href: string }) {
  const t = useT()
  return (
    <Link
      href={href}
      onClick={tapFeedback}
      className="ed-focus rounded text-[12.5px] font-semibold text-[var(--home-sage-deep)] dark:text-[var(--home-sage)]"
    >
      {t('See all')}</Link>
  )
}

/** A search: a sheikh's imitations first when the query names one, then everything else it matches. */
function SearchResults({ query, viewer }: { query: string; viewer: AppUser | null }) {
  const t = useT()
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

  const onRemoved = useCallback((id: string) => {
    setResults((prev) => prev?.filter((x) => x.id !== id) ?? prev)
    setImitations((prev) => prev?.filter((x) => x.id !== id) ?? prev)
  }, [])

  const cards = (list: Recitation[]) => (
    <RecitationCards>
      {list.map((r, i) => (
        <RecitationCard
          key={r.id}
          recitation={r}
          queue={list}
          index={i}
          viewerId={viewerId}
          viewerUsername={viewer?.username ?? null}
          onNotice={qariNotice}
          onRemoved={onRemoved}
        />
      ))}
    </RecitationCards>
  )

  return (
    <div className="mt-4">
      {sheikh ? (
        <>
          <SheikhHeader sheikh={sheikh} count={stats?.count ?? null} people={stats?.people ?? null} />
          <QariLabel>{t('Imitations')}</QariLabel>
          <QariSegmented
            label={t('Sort imitations')}
            value={sort}
            onChange={setSort}
            options={[
              { id: 'top', label: t('Most loved') },
              { id: 'recent', label: t('Latest') },
            ]}
          />
          <div className="mt-3">
            {imitations === null ? (
              <RecitationSkeletons count={2} />
            ) : imitations.length === 0 ? (
              <p className="qari-enter home-card rounded-2xl px-4 py-3.5 text-sm leading-relaxed text-[var(--home-muted)]">
                {t('No one has imitated {name} yet. Be the first.', { name: sheikh.shortName })}</p>
            ) : (
              cards(imitations)
            )}
          </div>
        </>
      ) : null}

      {others === null ? (
        sheikh ? null : <RecitationSkeletons count={3} />
      ) : others.length > 0 ? (
        <>
          <QariLabel className={sheikh ? undefined : 'mt-1'}>
            {sheikh ? t('More results') : t('Results for “{query}”', { query })}
          </QariLabel>
          {cards(others)}
        </>
      ) : !sheikh ? (
        <EmptyState
          Icon={SearchX}
          title={t('Nothing found')}
          body={t('Nothing matches “{query}”. Try a qari\'s name, a title or a #tag.', { query })}
        />
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
