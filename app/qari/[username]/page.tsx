'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { Heart, Mic, Pause, Pencil, Play, Share2 } from 'lucide-react'
import EditProfileSheet from '@/components/qari/EditProfileSheet'
import EmptyState from '@/components/qari/EmptyState'
import FollowButton from '@/components/qari/FollowButton'
import { PullIndicator, usePullToRefresh } from '@/components/qari/PullToRefresh'
import QariAvatar from '@/components/qari/QariAvatar'
import RecitationCard, { RecitationCards, RecitationSkeletons } from '@/components/qari/RecitationCard'
import {
  QariHeader,
  QariLabel,
  QariScreen,
  QariSegmented,
  qariNotice,
  useViewer,
} from '@/components/qari/QariShell'
import { useQariPlayer } from '@/hooks/useQariPlayer'
import { tapFeedback } from '@/lib/haptics'
import { compactNumber, fetchFeed, fetchFollowState, type Recitation } from '@/lib/qari'
import { onPlayerError, pausePlayback, playRecitation } from '@/lib/qari-player'
import { copyText } from '@/lib/qari-share-media'
import { APP_NAME } from '@/lib/app-brand'

type Tab = 'recitations' | 'favourites'

export default function QariProfilePage() {
  const params = useParams<{ username: string }>()
  const username = decodeURIComponent(String(params?.username ?? ''))
  const viewer = useViewer()
  const viewerId = viewer?.id ?? null
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

  useEffect(() => onPlayerError(qariNotice), [])

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
    qariNotice(ok ? 'Profile link copied.' : 'Could not share that.')
  }, [displayName, username])

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

  const tabs = isMe
    ? [
        { id: 'recitations' as const, label: 'Recitations' },
        { id: 'favourites' as const, label: 'Favourites' },
      ]
    : null

  return (
    <QariScreen>
      <PullIndicator pull={pull} refreshing={refreshing} />

      <QariHeader
        action={
          <button type="button" onClick={() => void handleShare()} className="home-round ed-focus" aria-label="Share profile">
            <Share2 className="h-[18px] w-[18px]" strokeWidth={1.9} />
          </button>
        }
      />

      {/* Identity */}
      <section className="qari-enter mt-1.5 flex flex-col items-center text-center">
        <div className="relative">
          <div className="rounded-full shadow-[0_16px_34px_-18px_rgba(22,23,27,0.5)]">
            <QariAvatar username={username} name={displayName} size={96} version={avatarVersion} />
          </div>
          {isMe ? (
            <button
              type="button"
              onClick={() => {
                tapFeedback()
                setEditOpen(true)
              }}
              aria-label="Edit profile picture"
              className="qari-press ed-focus ed-ink absolute -right-0.5 bottom-0 flex h-8 w-8 items-center justify-center rounded-full border-[3px] border-[var(--app-bg)]"
            >
              <Pencil className="h-[13px] w-[13px]" strokeWidth={2.4} />
            </button>
          ) : null}
        </div>

        <h1 className="home-serif mt-3.5 max-w-full truncate text-[1.75rem] font-semibold leading-tight tracking-[-0.02em] text-[var(--home-heading)]">
          {displayName}
        </h1>
        <p className="mt-0.5 text-sm text-[var(--home-muted)]">@{username}</p>
      </section>

      <div className="home-card mt-4 grid grid-cols-3 rounded-2xl py-3">
        <Stat value={recitations === null ? null : totals.count} label={totals.count === 1 ? 'recitation' : 'recitations'} />
        <Stat value={recitations === null ? null : totals.plays} label={totals.plays === 1 ? 'play' : 'plays'} divided />
        <Stat value={recitations === null ? null : totals.loved} label="loved" divided />
      </div>

      <div className="mt-3.5 grid grid-cols-2 gap-2">
        {isMe ? (
          <button
            type="button"
            onClick={() => {
              tapFeedback()
              setEditOpen(true)
            }}
            className="qari-press ed-focus flex h-12 items-center justify-center gap-2 rounded-full border border-[var(--home-rule-strong)] text-[14.5px] font-semibold text-[var(--home-heading)]"
          >
            <Pencil className="h-4 w-4" strokeWidth={2} />
            Edit profile
          </button>
        ) : (
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
        )}
        <button
          type="button"
          onClick={() => void handleShare()}
          className="qari-press ed-focus flex h-12 items-center justify-center gap-2 rounded-full border border-[var(--home-rule-strong)] text-[14.5px] font-semibold text-[var(--home-heading)]"
        >
          <Share2 className="h-4 w-4" strokeWidth={2} />
          Share profile
        </button>
      </div>

      {/* Tabs and play all */}
      {tabs ? (
        <div className="mt-[22px] flex items-center gap-2.5">
          <QariSegmented label="Profile sections" options={tabs} value={tab} onChange={setTab} className="min-w-0 flex-1" />
          <button
            type="button"
            onClick={playAll}
            disabled={!list || list.length === 0}
            aria-label={playingNow ? 'Pause' : 'Play all'}
            className="qari-press ed-focus ed-ink flex h-11 w-11 shrink-0 items-center justify-center rounded-full disabled:opacity-40"
          >
            {playingNow ? (
              <Pause key="pause" className="qari-swap h-4 w-4 fill-current" strokeWidth={0} />
            ) : (
              <Play key="play" className="qari-swap ml-0.5 h-4 w-4 fill-current" strokeWidth={0} />
            )}
          </button>
        </div>
      ) : (
        <QariLabel
          action={
            list && list.length > 0 ? (
              <button
                type="button"
                onClick={playAll}
                className="qari-press ed-focus ed-ink flex h-[34px] items-center gap-1.5 rounded-full pl-2.5 pr-[13px] text-[13px] font-semibold"
              >
                {playingNow ? (
                  <Pause key="pause" className="qari-swap h-[13px] w-[13px] fill-current" strokeWidth={0} />
                ) : (
                  <Play key="play" className="qari-swap h-[13px] w-[13px] fill-current" strokeWidth={0} />
                )}
                {playingNow ? 'Pause' : 'Play all'}
              </button>
            ) : null
          }
        >
          {recitations === null ? 'Recitations' : `Recitations · ${recitations.length}`}
        </QariLabel>
      )}

      <div className={tabs ? 'mt-3' : undefined}>
        {list === null ? (
          <RecitationSkeletons count={3} />
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

/** One total in the stats card: a serif number over its word. */
function Stat({ value, label, divided = false }: { value: number | null; label: string; divided?: boolean }) {
  return (
    <div className={divided ? 'border-l border-[var(--home-rule)] text-center' : 'text-center'}>
      <div className="home-serif flex h-7 items-center justify-center text-[1.375rem] font-semibold tabular-nums text-[var(--home-heading)]">
        {value === null ? <span className="qari-skeleton block h-5 w-8 rounded-md" /> : compactNumber(value)}
      </div>
      <p className="mt-px text-xs text-[var(--home-muted)]">{label}</p>
    </div>
  )
}
