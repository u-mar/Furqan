'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { ChevronLeft, Heart, Mic, Pause, Pencil, Play, Share2 } from 'lucide-react'
import EditProfileSheet from '@/components/qari/EditProfileSheet'
import EmptyState from '@/components/qari/EmptyState'
import FollowButton from '@/components/qari/FollowButton'
import { PullIndicator, usePullToRefresh } from '@/components/qari/PullToRefresh'
import QariAvatar from '@/components/qari/QariAvatar'
import RecitationRow from '@/components/qari/RecitationRow'
import SkeletonRows from '@/components/qari/SkeletonRows'
import { Notice, QariScreen, useNotice, useViewer } from '@/components/qari/QariShell'
import { useQariPlayer } from '@/hooks/useQariPlayer'
import { tapFeedback } from '@/lib/haptics'
import { fetchFeed, fetchFollowState, type Recitation } from '@/lib/qari'
import { onPlayerError, pausePlayback, playRecitation } from '@/lib/qari-player'
import { copyText } from '@/lib/qari-share-media'
import { APP_NAME } from '@/lib/app-brand'
import { cn } from '@/lib/cn'

type Tab = 'recitations' | 'favourites'

export default function QariProfilePage() {
  const params = useParams<{ username: string }>()
  const username = decodeURIComponent(String(params?.username ?? ''))
  const viewer = useViewer()
  const viewerId = viewer?.id ?? null
  const { notice, setNotice } = useNotice()
  const player = useQariPlayer()

  // Usernames are stored lower-case; a link may arrive with any casing.
  const isMe = viewer?.username.toLowerCase() === username.toLowerCase()

  const [tab, setTab] = useState<Tab>('recitations')
  const [recitations, setRecitations] = useState<Recitation[] | null>(null)
  const [favourites, setFavourites] = useState<Recitation[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [follow, setFollow] = useState<{ following: boolean; followers: number } | null>(null)

  const [editOpen, setEditOpen] = useState(false)
  const [avatarVersion, setAvatarVersion] = useState<number | undefined>(undefined)
  const [hasAvatar, setHasAvatar] = useState(false)
  const [nameOverride, setNameOverride] = useState<string | null>(null)

  useEffect(() => onPlayerError(setNotice), [setNotice])

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
    setRecitations(null)
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
    setNotice(ok ? 'Profile link copied.' : 'Could not share that.')
  }, [displayName, setNotice, username])

  const totals = useMemo(() => {
    const list = recitations ?? []
    return {
      count: list.length,
      plays: list.reduce((sum, r) => sum + r.playCount, 0),
      loved: list.reduce((sum, r) => sum + r.likeCount, 0),
    }
  }, [recitations])

  const list = tab === 'recitations' ? recitations : favourites
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

  const removeRecitation = useCallback((id: string) => {
    setRecitations((prev) => prev?.filter((r) => r.id !== id) ?? prev)
    setFavourites((prev) => prev?.filter((r) => r.id !== id) ?? prev)
  }, [])

  return (
    <QariScreen>
      <PullIndicator pull={pull} refreshing={refreshing} />

      <header className="flex items-center">
        <Link
          href="/qari"
          aria-label="Back"
          className="qari-press ed-focus flex h-11 w-11 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--home-heading)_7%,transparent)] text-[var(--home-heading)]"
        >
          <ChevronLeft className="h-[22px] w-[22px]" strokeWidth={2.2} />
        </Link>
      </header>

      {/* Identity */}
      <section className="qari-enter flex flex-col items-center text-center">
        <div className="relative">
          <div className="rounded-full shadow-[0_16px_40px_-12px_rgba(0,0,0,0.5)]">
            <QariAvatar username={username} name={displayName} size={108} version={avatarVersion} />
          </div>
          {isMe ? (
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              aria-label="Edit profile picture"
              className="qari-press ed-focus ed-ink absolute -right-0.5 bottom-0 flex h-[34px] w-[34px] items-center justify-center rounded-full border-[3px] border-[var(--app-bg)]"
            >
              <Pencil className="h-[13px] w-[13px]" strokeWidth={2.6} />
            </button>
          ) : null}
        </div>

        <h1 className="mt-4 max-w-full truncate text-[1.75rem] font-extrabold leading-tight tracking-[-0.025em] text-[var(--home-heading)]">
          {displayName}
        </h1>
        <p className="mt-0.5 text-sm font-medium text-[var(--home-muted)]">@{username}</p>

        <div className="mt-3 flex items-center gap-4 text-sm font-bold text-[var(--home-heading)]">
          <Stat value={totals.count} Icon={Mic} label="recitations" />
          <Stat value={totals.plays} Icon={Play} label="plays" />
          <Stat value={totals.loved} Icon={Heart} label="loved" />
        </div>

        <div className="mt-5 flex w-full gap-2">
          {isMe ? (
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="qari-press ed-focus flex h-11 flex-1 items-center justify-center gap-2 rounded-full border border-[var(--home-card-border)] bg-[var(--home-card-bg)] text-sm font-bold text-[var(--home-heading)]"
            >
              <Pencil className="h-[15px] w-[15px]" strokeWidth={2.3} />
              Edit profile
            </button>
          ) : (
            <FollowButton
              size="lg"
              viewer={viewer}
              target={username}
              following={follow?.following ?? false}
              onNotice={setNotice}
              onChange={(state) =>
                setFollow((prev) => ({
                  following: state.following,
                  followers:
                    state.followers ??
                    Math.max(0, (prev?.followers ?? 0) + (state.following === prev?.following ? 0 : state.following ? 1 : -1)),
                }))
              }
            />
          )}
          <button
            type="button"
            onClick={() => void handleShare()}
            className="qari-press ed-focus flex h-11 flex-1 items-center justify-center gap-2 rounded-full border border-[var(--home-card-border)] bg-[var(--home-card-bg)] text-sm font-bold text-[var(--home-heading)]"
          >
            <Share2 className="h-[15px] w-[15px]" strokeWidth={2.3} />
            Share profile
          </button>
        </div>
      </section>

      {/* Tabs and play all */}
      <div className="mt-6 flex items-center justify-between gap-3 pb-1.5">
        <div className="flex gap-2" role="tablist" aria-label="Profile sections">
          {(isMe
            ? ([
                { id: 'recitations', label: 'Recitations' },
                { id: 'favourites', label: 'Favourites' },
              ] as const)
            : ([{ id: 'recitations', label: 'Recitations' }] as const)
          ).map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => {
                tapFeedback()
                setTab(id)
              }}
              className={cn(
                'qari-press ed-focus h-9 rounded-full px-4 text-sm transition-colors',
                tab === id
                  ? 'ed-ink font-bold'
                  : 'border border-[var(--home-card-border)] bg-[var(--home-card-bg)] font-semibold text-[var(--home-heading)]'
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {list && list.length > 0 ? (
          <button
            type="button"
            onClick={playAll}
            aria-label={playingNow ? 'Pause' : 'Play all'}
            className={cn(
              'qari-press ed-focus flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full shadow-[0_8px_24px_-6px_color-mix(in_srgb,var(--home-sage)_45%,transparent)]',
              playingNow ? 'bg-[var(--home-sage-deep)] text-white' : 'bg-[var(--home-sage)] text-[var(--home-ink-fg)]'
            )}
          >
            {playingNow ? (
              <Pause key="pause" className="qari-swap h-5 w-5 fill-current" strokeWidth={0} />
            ) : (
              <Play key="play" className="qari-swap ml-0.5 h-5 w-5 fill-current" strokeWidth={0} />
            )}
          </button>
        ) : null}
      </div>

      <div>
        {list === null ? (
          <SkeletonRows count={4} />
        ) : failed && tab === 'recitations' ? (
          <EmptyState
            Icon={Mic}
            title="Could not load this profile"
            body="Check your connection and try again."
            action={{ label: 'Try again', onClick: () => void loadRecitations() }}
          />
        ) : list.length === 0 ? (
          tab === 'favourites' ? (
            <EmptyState
              Icon={Heart}
              title="Nothing saved yet"
              body="Tap the heart on a recitation and it will be waiting here."
              action={{ label: 'Explore Qari', href: '/qari' }}
            />
          ) : isMe ? (
            <EmptyState
              Icon={Mic}
              title="No recitations yet"
              body="Record a few ayahs and they will appear here."
              action={{ label: 'Record one', href: '/qari/record', Icon: Mic }}
            />
          ) : (
            <EmptyState Icon={Mic} title="Nothing published yet" body={`${displayName} hasn't published anything yet.`} />
          )
        ) : (
          <div>
            {list.map((recitation, i) => (
              <RecitationRow
                key={recitation.id}
                recitation={recitation}
                queue={list}
                index={i}
                hideAuthor={tab === 'recitations'}
                viewerId={viewerId}
                viewerUsername={viewer?.username ?? null}
                onRemoved={removeRecitation}
                onNotice={setNotice}
              />
            ))}
          </div>
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
          onNotice={setNotice}
        />
      ) : null}

      <Notice message={notice} />
    </QariScreen>
  )
}

/** A number with its icon after it — "1 ♥" rather than "1 loved". */
function Stat({ value, Icon, label }: { value: number; Icon: typeof Mic; label: string }) {
  return (
    <span className="flex items-center gap-1.5" aria-label={`${value} ${label}`}>
      <span className="tabular-nums">{value}</span>
      <Icon className="h-[15px] w-[15px] text-[var(--home-muted)]" strokeWidth={2.2} aria-hidden />
    </span>
  )
}
