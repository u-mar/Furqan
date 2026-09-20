'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { Heart, Mic, Pause, Play } from 'lucide-react'
import EditProfileSheet from '@/components/qari/EditProfileSheet'
import EmptyState from '@/components/qari/EmptyState'
import FollowButton from '@/components/qari/FollowButton'
import { PullIndicator, usePullToRefresh } from '@/components/qari/PullToRefresh'
import ProfileHero, { ProfileTopBar } from '@/components/qari/ProfileHero'
import RecitationCard, { RecitationCards, RecitationSkeletons } from '@/components/qari/RecitationCard'
import {
  QariScreen,
  qariNotice,
  useViewer,
} from '@/components/qari/QariShell'
import { useQariPlayer } from '@/hooks/useQariPlayer'
import { tapFeedback } from '@/lib/haptics'
import { cn } from '@/lib/cn'
import { fetchFeed, fetchFollowState, type Recitation } from '@/lib/qari'
import { onPlayerError, pausePlayback, playRecitation } from '@/lib/qari-player'
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
        { id: 'recitations' as const, label: t('Recitations') },
        { id: 'favourites' as const, label: t('Favourites') },
      ]
    : null

  return (
    <QariScreen>
      <PullIndicator pull={pull} refreshing={refreshing} />

      <ProfileTopBar username={username} name={displayName} avatarVersion={avatarVersion} onShare={() => void handleShare()} />

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
            )
          }
        />
      </div>

      {/* Tabs and play all */}
      <div className="mt-6 flex items-center justify-between border-b border-[var(--home-rule)]">
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
                'ed-focus relative h-11 text-[14.5px] font-semibold transition-colors',
                tab === id ? 'text-[var(--home-heading)]' : 'text-[var(--home-muted)]'
              )}
            >
              {label}
              {id === 'recitations' && recitations ? (
                <span className="ml-1.5 text-[12.5px] font-medium text-[var(--home-muted)]">{recitations.length}</span>
              ) : null}
              <span
                className={cn(
                  'absolute inset-x-0 -bottom-px h-[2.5px] rounded-full bg-[var(--home-heading)] transition-opacity',
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
            className="ed-ink qari-press ed-focus mb-1 flex h-[34px] items-center gap-1.5 rounded-full pl-2.5 pr-[13px] text-[13px] font-semibold"
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

      <div className="mt-3">
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
          tab === 'favourites' ? (
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
