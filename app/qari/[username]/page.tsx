'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { Ban, ChevronLeft, Ellipsis, Heart, Mic, Pause, Play } from 'lucide-react'
import EditProfileSheet from '@/components/qari/EditProfileSheet'
import EmptyState from '@/components/qari/EmptyState'
import FollowButton from '@/components/qari/FollowButton'
import { PullIndicator, usePullToRefresh } from '@/components/qari/PullToRefresh'
import ProfileHero, { ProfileTopBar } from '@/components/qari/ProfileHero'
import RecitationCard, { RecitationCards, RecitationSkeletons } from '@/components/qari/RecitationCard'
import SwipeFeed from '@/components/qari/SwipeFeed'
import UploadCard from '@/components/qari/UploadCard'
import {
  QariScreen,
  qariNotice,
  useViewer,
} from '@/components/qari/QariShell'
import { useQariPlayer } from '@/hooks/useQariPlayer'
import { tapFeedback } from '@/lib/haptics'
import { cn } from '@/lib/cn'
import { fetchFeed, fetchFollowState, peekFeed, type Recitation } from '@/lib/qari'
import { onPlayerError, pausePlayback, playRecitation } from '@/lib/qari-player'
import { dismissUpload, useUploads } from '@/lib/qari-upload'
import { blockUser, unblockUser, useBlockedUsers } from '@/lib/qari-blocks'
import { askToSignIn } from '@/lib/account-prompt'
import { copyText } from '@/lib/qari-share-media'
import { APP_NAME } from '@/lib/app-brand'
import { tr, useT } from '@/lib/i18n'

type Tab = 'recitations' | 'favourites'

export default function QariProfilePage() {
  const t = useT()
  const params = useParams<{ username: string }>()
  const username = decodeURIComponent(String(params?.username ?? ''))
  const viewer = useViewer()
  const viewerId = viewer?.id ?? null
  const player = useQariPlayer()

  // Usernames are stored lower-case; a link may arrive with any casing.
  const isMe = viewer?.username.toLowerCase() === username.toLowerCase()
  const blockedUsers = useBlockedUsers(viewer)
  const isBlocked = !isMe && blockedUsers.has(username.toLowerCase())

  const [tab, setTab] = useState<Tab>('recitations')
  const [recitations, setRecitations] = useState<Recitation[] | null>(null)
  const [favourites, setFavourites] = useState<Recitation[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [follow, setFollow] = useState<{ following: boolean; followers: number } | null>(null)

  const [editOpen, setEditOpen] = useState(false)
  const [avatarVersion, setAvatarVersion] = useState<number | undefined>(undefined)
  const [hasAvatar, setHasAvatar] = useState(false)
  const [nameOverride, setNameOverride] = useState<string | null>(null)

  useEffect(() => onPlayerError(qariNotice), [])

  // Recitations this reciter is posting right now, shown uploading at the top.
  const uploads = useUploads()
  const myUploads = useMemo(
    () => (isMe ? uploads.filter((u) => u.userUsername.toLowerCase() === username.toLowerCase()) : []),
    [isMe, uploads, username]
  )

  // A posted one joins the list proper, after a moment showing it is done.
  useEffect(() => {
    const finished = myUploads.filter((u) => u.stage === 'done' && u.recitation)
    if (finished.length === 0) return
    const id = window.setTimeout(() => {
      setRecitations((prev) => {
        const list = prev ?? []
        const added = finished.flatMap((u) => (u.recitation ? [u.recitation] : [])).filter((r) => !list.some((x) => x.id === r.id))
        return [...added, ...list]
      })
      for (const u of finished) dismissUpload(u.key)
    }, 1200)
    return () => window.clearTimeout(id)
  }, [myUploads])

  const loadRecitations = useCallback(async () => {
    if (!username) return
    setFailed(false)
    try {
      const page = await fetchFeed({ user: username, viewerId, take: 50 })
      setRecitations(page.items)
    } catch {
      setFailed(true)
      setRecitations([])
    }
  }, [username, viewerId])

  useEffect(() => {
    setRecitations(username ? (peekFeed({ user: username, viewerId, take: 50 })?.items ?? null) : null)
    void loadRecitations()
  }, [loadRecitations])

  useEffect(() => {
    if (!username) return
    let cancelled = false
    fetchFollowState(username, viewerId).then((state) => !cancelled && setFollow(state))
    return () => {
      cancelled = true
    }
  }, [username, viewerId])

  /* Favourites are yours alone, fetched the first time that tab opens. */
  useEffect(() => {
    if (tab !== 'favourites' || favourites !== null || !viewerId) return
    let cancelled = false
    fetchFeed({ likedBy: viewerId, viewerId, take: 50 })
      .then((page) => !cancelled && setFavourites(page.items))
      .catch(() => !cancelled && setFavourites([]))
    return () => {
      cancelled = true
    }
  }, [tab, favourites, viewerId])

  /* Whether there is a picture to offer removing. */
  useEffect(() => {
    if (!username) return
    let cancelled = false
    void fetch(`/api/qari/avatar/${encodeURIComponent(username)}`, { method: 'HEAD' })
      .then((res) => !cancelled && setHasAvatar(res.ok))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [username, avatarVersion])

  const { pull, refreshing } = usePullToRefresh(async () => {
    await loadRecitations()
    if (tab === 'favourites') setFavourites(null)
  })

  const handleSaved = useCallback((changes: { name?: string; avatarChanged?: boolean }) => {
    if (changes.name) {
      const saved = changes.name
      setNameOverride(saved)
      setRecitations((prev) => prev?.map((r) => ({ ...r, userName: saved })) ?? prev)
    }
    if (changes.avatarChanged) setAvatarVersion(Date.now())
  }, [])

  const displayName =
    nameOverride || recitations?.[0]?.userName || (isMe ? viewer?.name : '') || username

  const handleShare = useCallback(async () => {
    tapFeedback()
    const url = `${window.location.origin}/qari/${encodeURIComponent(username)}`
    const text = `${displayName} on ${APP_NAME}`
    try {
      if (navigator.share) {
        await navigator.share({ title: text, text, url })
        return
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
    }
    const ok = await copyText(url)
    qariNotice(ok ? tr('Profile link copied.') : tr('Could not share that.'))
  }, [displayName, username])

  const totals = useMemo(() => {
    const list = recitations ?? []
    return {
      count: list.length,
      plays: list.reduce((sum, r) => sum + r.playCount, 0),
      loved: list.reduce((sum, r) => sum + r.likeCount, 0),
    }
  }, [recitations])

  const sheikhIds = useMemo(() => {
    const counts = new Map<string, number>()
    for (const r of recitations ?? []) if (r.imitating) counts.set(r.imitating, (counts.get(r.imitating) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id)
  }, [recitations])

  // Recitations are listed to listen to; ayah cards (pictures) sit in a row above, opening full screen.
  const shown = tab === 'recitations' ? recitations : favourites
  const list = useMemo(() => shown?.filter((r) => r.kind !== 'ayah') ?? null, [shown])
  const ayahCards = useMemo(() => shown?.filter((r) => r.kind === 'ayah') ?? [], [shown])
  const [cardsOpen, setCardsOpen] = useState<{ items: Recitation[]; startId: string } | null>(null)
  const listIds = useMemo(() => new Set((list ?? []).map((r) => r.id)), [list])
  const playingHere = Boolean(player.current && listIds.has(player.current.id))
  const playingNow = playingHere && (player.status === 'playing' || player.status === 'loading')

  const playAll = useCallback(() => {
    if (!list || list.length === 0) return
    tapFeedback()
    if (playingNow) {
      pausePlayback()
      return
    }
    const start = playingHere && player.current ? player.current : list[0]
    playRecitation(start, { queue: list, viewerId })
  }, [list, player, playingHere, playingNow, viewerId])

  const toggleBlock = useCallback(async () => {
    if (!viewer) {
      askToSignIn({ reason: tr('Create a free account to block someone.') })
      return
    }
    tapFeedback()
    try {
      if (isBlocked) {
        await unblockUser(viewer, username)
        qariNotice(tr('Unblocked @{username}.', { username }))
        void loadRecitations()
      } else {
        await blockUser(viewer, username)
        setFollow((prev) => (prev ? { ...prev, following: false } : prev))
        qariNotice(tr('Blocked @{username}. You won’t see their posts.', { username }))
      }
    } catch (err) {
      qariNotice(err instanceof Error ? err.message : tr('Could not change that.'))
    }
  }, [isBlocked, loadRecitations, username, viewer])

  const removeRecitation = useCallback((id: string) => {
    setRecitations((prev) => prev?.filter((r) => r.id !== id) ?? prev)
    setFavourites((prev) => prev?.filter((r) => r.id !== id) ?? prev)
  }, [])

  // This is always the owner's own profile when the menu offers it, and it
  // shows private recitations too — so a privacy change patches in place
  // rather than removing the row.
  const updateRecitation = useCallback((id: string, patch: Partial<Recitation>) => {
    const apply = (prev: Recitation[] | null) => prev?.map((r) => (r.id === id ? { ...r, ...patch } : r)) ?? prev
    setRecitations(apply)
    setFavourites(apply)
  }, [])

  const tabs = isMe
    ? [
        { id: 'recitations' as const, label: t('Recitations') },
        { id: 'favourites' as const, label: t('Favourites') },
      ]
    : null

  if (cardsOpen) {
    return (
      <QariScreen bare recordFab={false}>
        <SwipeFeed
          items={cardsOpen.items}
          hasMore={false}
          loadingMore={false}
          onLoadMore={() => {}}
          startId={cardsOpen.startId}
          autoplay={false}
          viewerId={viewerId}
          viewerUsername={viewer?.username ?? null}
          onRemoved={(id) => {
            removeRecitation(id)
            setCardsOpen((prev) => {
              const items = prev?.items.filter((r) => r.id !== id) ?? []
              return prev && items.length ? { ...prev, items } : null
            })
          }}
          onUpdated={updateRecitation}
          onNotice={qariNotice}
        />
        <div className="qari-swipe pointer-events-none fixed inset-x-0 top-0 z-40 bg-gradient-to-b from-black/55 to-transparent pb-8 [&_button]:pointer-events-auto">
          <div className="mx-auto max-w-lg px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <button
              type="button"
              onClick={() => {
                tapFeedback()
                setCardsOpen(null)
              }}
              className="home-round ed-focus"
              aria-label={t('Back')}
            >
              <ChevronLeft className="h-5 w-5" strokeWidth={1.9} />
            </button>
          </div>
        </div>
      </QariScreen>
    )
  }

  return (
    <QariScreen>
      <PullIndicator pull={pull} refreshing={refreshing} />

      <ProfileTopBar
        username={username}
        name={displayName}
        avatarVersion={avatarVersion}
        showNotifications={isMe}
        onShare={() => void handleShare()}
        extra={isMe ? null : <ProfileMenu blocked={isBlocked} username={username} onToggleBlock={() => void toggleBlock()} />}
      />

      <div className="mt-1">
        <ProfileHero
          username={username}
          name={displayName}
          isMe={isMe}
          avatarVersion={avatarVersion}
          stats={{
            followers: follow === null ? null : follow.followers,
            plays: recitations === null ? null : totals.plays,
            loved: recitations === null ? null : totals.loved,
          }}
          sheikhIds={sheikhIds}
          onShare={() => void handleShare()}
          onEditPicture={() => setEditOpen(true)}
          actions={
            isMe ? (
              <button
                type="button"
                onClick={() => {
                  tapFeedback()
                  setEditOpen(true)
                }}
                className="qari-press ed-focus flex h-11 w-full items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--home-heading)_8%,transparent)] text-[14.5px] font-semibold text-[var(--home-heading)]"
              >
                {t('Edit profile')}</button>
            ) : isBlocked ? null : (
              <FollowButton
                size="lg"
                viewer={viewer}
                target={username}
                following={follow?.following ?? false}
                onNotice={qariNotice}
                onChange={(state) =>
                  setFollow((prev) => ({
                    following: state.following,
                    followers:
                      state.followers ??
                      Math.max(0, (prev?.followers ?? 0) + (state.following === prev?.following ? 0 : state.following ? 1 : -1)),
                  }))
                }
              />
            )
          }
        />
      </div>

      {isBlocked ? (
        <div className="qari-card mt-6 px-4 py-5 text-center">
          <p className="home-serif text-[1.1875rem] font-medium text-[var(--home-heading)]">
            {t('You blocked @{username}', { username })}
          </p>
          <p className="mx-auto mt-1 max-w-[30ch] text-[13px] leading-relaxed text-[var(--home-muted)]">
            {t('You don’t see their posts in Qari, and they can’t follow you.')}
          </p>
          <button
            type="button"
            onClick={() => void toggleBlock()}
            className="qari-press ed-focus mx-auto mt-4 flex h-10 items-center rounded-full border border-[var(--home-rule-strong)] px-5 text-[14px] font-semibold text-[var(--home-heading)]"
          >
            {t('Unblock')}
          </button>
        </div>
      ) : null}

      {/* Tabs and play all */}
      <div className={cn('mt-6 flex items-center justify-between border-b border-[var(--home-rule)]', isBlocked && 'hidden')}>
        <div className="flex gap-6" role="tablist" aria-label={t('Profile sections')}>
          {(tabs ?? [{ id: 'recitations' as const, label: t('Recitations') }]).map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => {
                if (tab === id) return
                tapFeedback()
                setTab(id)
              }}
              className={cn(
                'ed-focus relative h-11 text-[14.5px] font-medium transition-colors',
                tab === id ? 'text-[var(--home-heading)]' : 'text-[var(--home-muted)]'
              )}
            >
              {label}
              {id === 'recitations' && recitations ? (
                <span className="ml-1.5 text-[12.5px] font-medium text-[var(--home-muted)]">
                  {recitations.filter((r) => r.kind !== 'ayah').length}
                </span>
              ) : null}
              <span
                className={cn(
                  'absolute inset-x-0 -bottom-px h-[2.5px] rounded-full bg-[var(--home-sage)] transition-opacity',
                  tab === id ? 'opacity-100' : 'opacity-0'
                )}
              />
            </button>
          ))}
        </div>
        {list && list.length > 0 ? (
          <button
            type="button"
            onClick={playAll}
            aria-label={playingNow ? t('Pause') : t('Play all')}
            className="qari-press ed-focus mb-1 flex h-[34px] items-center gap-1.5 rounded-full bg-[var(--home-sage)] pl-2.5 pr-[13px] text-[13px] font-medium text-[var(--qari-on-teal)]"
          >
            {playingNow ? (
              <Pause key="pause" className="qari-swap h-[13px] w-[13px] fill-current" strokeWidth={0} />
            ) : (
              <Play key="play" className="qari-swap h-[13px] w-[13px] fill-current" strokeWidth={0} />
            )}
            {playingNow ? t('Pause') : t('Play all')}
          </button>
        ) : null}
      </div>

      <div className={cn('mt-3', isBlocked && 'hidden')}>
        {tab === 'recitations' && myUploads.length > 0 ? (
          <div className={cn('flex flex-col gap-2.5', list && list.length > 0 && 'mb-2.5')}>
            {myUploads.map((upload) => (
              <UploadCard key={upload.key} upload={upload} />
            ))}
          </div>
        ) : null}
        {ayahCards.length > 0 ? (
          <AyahCardRow cards={ayahCards} onOpen={(startId) => setCardsOpen({ items: ayahCards, startId })} />
        ) : null}
        {list === null ? (
          <RecitationSkeletons count={3} />
        ) : failed && tab === 'recitations' ? (
          <EmptyState
            Icon={Mic}
            title={t('Could not load this profile')}
            body={t('Check your connection and try again.')}
            action={{ label: t('Try again'), onClick: () => void loadRecitations() }}
          />
        ) : list.length === 0 ? (
          (tab === 'recitations' && myUploads.length > 0) || ayahCards.length > 0 ? null : tab === 'favourites' ? (
            <EmptyState
              Icon={Heart}
              title={t('Nothing saved yet')}
              body={t('Tap the heart on a recitation and it will be waiting here.')}
              action={{ label: t('Explore Qari'), href: '/qari' }}
            />
          ) : isMe ? (
            <EmptyState
              Icon={Mic}
              title={t('No recitations yet')}
              body={t('Record a few ayahs and they will appear here.')}
              action={{ label: t('Record one'), href: '/qari/record', Icon: Mic }}
            />
          ) : (
            <EmptyState Icon={Mic} title={t('Nothing published yet')} body={`${displayName} hasn't published anything yet.`} />
          )
        ) : (
          <RecitationCards>
            {list.map((recitation, i) => (
              <RecitationCard
                key={recitation.id}
                recitation={recitation}
                queue={list}
                index={i}
                hideAuthor={tab === 'recitations'}
                viewerId={viewerId}
                viewerUsername={viewer?.username ?? null}
                onRemoved={removeRecitation}
                onUpdated={updateRecitation}
                onNotice={qariNotice}
              />
            ))}
          </RecitationCards>
        )}
      </div>

      {isMe && viewer ? (
        <EditProfileSheet
          open={editOpen}
          viewer={viewer}
          avatarVersion={avatarVersion}
          hasAvatar={hasAvatar}
          onClose={() => setEditOpen(false)}
          onSaved={handleSaved}
          onNotice={qariNotice}
        />
      ) : null}
    </QariScreen>
  )
}

/** A profile's ayah cards: a row of the pictures, each opening them all full screen at that one. */
function AyahCardRow({ cards, onOpen }: { cards: Recitation[]; onOpen: (id: string) => void }) {
  const t = useT()
  return (
    <section className="mb-4">
      <p className="mb-2 text-[13px] font-medium text-[var(--home-muted)]">
        {t('Ayah cards')} <span className="tabular-nums">{cards.length}</span>
      </p>
      <div className="-mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {cards.map((card) => (
          <button
            key={card.id}
            type="button"
            onClick={() => {
              tapFeedback()
              onOpen(card.id)
            }}
            aria-label={card.title}
            className="qari-press ed-focus relative aspect-[9/16] w-[6.25rem] shrink-0 overflow-hidden rounded-xl bg-[var(--home-track)] shadow-[0_8px_20px_-12px_rgba(0,0,0,0.5)]"
          >
            {card.imageUrl ? (
              <img src={card.imageUrl} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
            ) : null}
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 pb-1.5 pt-5 text-left text-[10.5px] font-semibold leading-tight text-white">
              <span className="line-clamp-2">{card.title}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}

/** Someone else's profile: Block (or Unblock) behind a "more" button, asked twice before blocking. */
function ProfileMenu({ blocked, username, onToggleBlock }: { blocked: boolean; username: string; onToggleBlock: () => void }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) {
      setConfirming(false)
      return
    }
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t('More')}
        aria-expanded={open}
        className="home-round ed-focus"
      >
        <Ellipsis className="h-[18px] w-[18px]" strokeWidth={1.9} />
      </button>
      {open ? (
        <div className="qari-dropdown__menu right-0 top-[calc(100%+0.3rem)] w-[13rem] origin-top-right">
          <button
            type="button"
            onClick={() => {
              if (!blocked && !confirming) {
                setConfirming(true)
                return
              }
              setOpen(false)
              onToggleBlock()
            }}
            className={cn('qari-dropdown__item ed-focus', !blocked && 'text-rose-500')}
          >
            <Ban className="h-4 w-4" strokeWidth={2} />
            <span className="truncate">
              {blocked
                ? t('Unblock @{username}', { username })
                : confirming
                  ? t('Tap again to block')
                  : t('Block @{username}', { username })}
            </span>
          </button>
        </div>
      ) : null}
    </div>
  )
}
