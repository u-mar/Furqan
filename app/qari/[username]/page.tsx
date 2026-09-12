'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { ChevronLeft, Heart, Mic, Pencil, Play, Share2 } from 'lucide-react'
import RecitationCard from '@/components/qari/RecitationCard'
import QariAvatar from '@/components/qari/QariAvatar'
import EditProfileSheet from '@/components/qari/EditProfileSheet'
import { Notice, QariScreen, useNotice, useViewer } from '@/components/qari/QariShell'
import { fetchFeed, type Recitation } from '@/lib/qari'

type Tab = 'audios' | 'favourites'

export default function QariProfilePage() {
  const params = useParams<{ username: string }>()
  const username = decodeURIComponent(String(params?.username ?? ''))
  const viewer = useViewer()
  const { notice, setNotice } = useNotice()

  // Usernames are stored lower-case; a link may arrive with any casing.
  const isMe = viewer?.username.toLowerCase() === username.toLowerCase()

  const [tab, setTab] = useState<Tab>('audios')
  const [audios, setAudios] = useState<Recitation[]>([])
  const [favourites, setFavourites] = useState<Recitation[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingFavourites, setLoadingFavourites] = useState(false)
  const [failed, setFailed] = useState(false)

  const [editOpen, setEditOpen] = useState(false)
  const [avatarVersion, setAvatarVersion] = useState<number | undefined>(undefined)
  const [hasAvatar, setHasAvatar] = useState(false)
  const [nameOverride, setNameOverride] = useState<string | null>(null)

  /* Their recitations — the default tab, so always loaded. */
  useEffect(() => {
    if (!username) return
    let cancelled = false

    void (async () => {
      setLoading(true)
      setFailed(false)
      try {
        const page = await fetchFeed({ user: username, viewerId: viewer?.id ?? null })
        if (!cancelled) setAudios(page.items)
      } catch {
        if (!cancelled) setFailed(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [username, viewer?.id])

  /* Favourites are fetched the first time that tab is opened. */
  useEffect(() => {
    if (tab !== 'favourites' || favourites !== null || !viewer?.id) return
    let cancelled = false

    void (async () => {
      setLoadingFavourites(true)
      try {
        const page = await fetchFeed({ likedBy: viewer.id, viewerId: viewer.id })
        if (!cancelled) setFavourites(page.items)
      } catch {
        if (!cancelled) setFavourites([])
      } finally {
        if (!cancelled) setLoadingFavourites(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [tab, favourites, viewer?.id])

  /* Whether there is a picture to offer removing. */
  useEffect(() => {
    if (!username) return
    let cancelled = false
    void fetch(`/api/qari/avatar/${encodeURIComponent(username)}`, { method: 'HEAD' })
      .then((res) => {
        if (!cancelled) setHasAvatar(res.ok)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [username, avatarVersion])

  const removeFromAudios = useCallback((id: string) => {
    setAudios((prev) => prev.filter((r) => r.id !== id))
    setFavourites((prev) => (prev ? prev.filter((r) => r.id !== id) : prev))
  }, [])

  const removeFromFavourites = useCallback((id: string) => {
    setFavourites((prev) => (prev ? prev.filter((r) => r.id !== id) : prev))
  }, [])

  const handleSaved = useCallback((changes: { name?: string; avatarChanged?: boolean }) => {
    if (changes.name) {
      const saved = changes.name
      setNameOverride(saved)
      // Past recordings carry the reciter's name, and the server rewrote
      // them — mirror that here so the list agrees without a refetch.
      setAudios((prev) => prev.map((r) => ({ ...r, userName: saved })))
    }
    if (changes.avatarChanged) setAvatarVersion(Date.now())
  }, [])

  const handleShare = useCallback(async () => {
    const url = `${window.location.origin}/qari/${encodeURIComponent(username)}`
    const text = `${nameOverride || audios[0]?.userName || username} on Al Furqaan`
    try {
      if (navigator.share) {
        await navigator.share({ title: text, text, url })
        return
      }
      await navigator.clipboard.writeText(url)
      setNotice('Profile link copied.')
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setNotice('Could not share that.')
    }
  }, [audios, nameOverride, setNotice, username])

  const displayName = nameOverride || audios[0]?.userName || (isMe ? viewer?.name : '') || username
  const totalPlays = useMemo(() => audios.reduce((sum, r) => sum + r.playCount, 0), [audios])
  const totalLikes = useMemo(() => audios.reduce((sum, r) => sum + r.likeCount, 0), [audios])

  const list = tab === 'audios' ? audios : (favourites ?? [])
  const listLoading = tab === 'audios' ? loading : loadingFavourites

  return (
    <QariScreen>
      {/* Header — the handle sits up here so the name can breathe below. */}
      <header className="mb-4 flex items-center gap-3">
        <Link
          href="/qari"
          aria-label="Back"
          className="ed-focus flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--home-rule-strong)] text-[var(--home-heading)] transition-colors hover:bg-[var(--home-ink)] hover:text-[var(--home-ink-fg)] active:scale-95"
        >
          <ChevronLeft className="h-5 w-5" strokeWidth={1.75} />
        </Link>
        <p className="min-w-0 flex-1 truncate text-center text-sm font-semibold text-[var(--home-heading)]">
          @{username}
        </p>
        <span className="h-11 w-11 shrink-0" aria-hidden />
      </header>

      {/* Identity */}
      <section className="text-center">
        <div className="relative mx-auto w-fit">
          <QariAvatar username={username} name={displayName} size={96} version={avatarVersion} />
          {isMe ? (
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              aria-label="Edit profile picture"
              className="ed-focus absolute -bottom-0.5 -right-0.5 flex h-8 w-8 items-center justify-center rounded-full border-2 border-[var(--app-surface)] bg-[var(--home-sage-deep)] text-white transition-transform active:scale-95"
            >
              <Pencil className="h-[14px] w-[14px]" strokeWidth={2.2} />
            </button>
          ) : null}
        </div>

        <h1 className="home-serif mt-3 truncate text-[1.6rem] font-semibold leading-tight text-[var(--home-heading)]">
          {displayName}
        </h1>

        <div className="mt-4 flex items-stretch justify-center">
          <Stat
            icon={<Mic className="h-4 w-4" strokeWidth={2} />}
            value={audios.length}
            label="recitations"
          />
          <span className="mx-1 w-px self-stretch bg-[var(--home-rule)]" />
          <Stat
            icon={<Play className="h-4 w-4" strokeWidth={2} />}
            value={totalPlays}
            label="plays"
          />
          <span className="mx-1 w-px self-stretch bg-[var(--home-rule)]" />
          <Stat
            icon={<Heart className="h-4 w-4 text-rose-500" strokeWidth={2} />}
            value={totalLikes}
            label="loved"
          />
        </div>

        {/* Actions sit under the profile, the way a profile page reads. */}
        <div className="mt-5 flex gap-2">
          {isMe ? (
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="ed-ink ed-focus flex h-11 flex-1 items-center justify-center gap-2 rounded-full text-sm font-semibold transition-transform active:scale-[0.98]"
            >
              <Pencil className="h-4 w-4" strokeWidth={2} />
              Edit profile
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void handleShare()}
            className="ed-focus flex h-11 flex-1 items-center justify-center gap-2 rounded-full border border-[var(--home-rule-strong)] text-sm font-semibold text-[var(--home-heading)] transition-colors hover:bg-[var(--home-track)] active:scale-[0.98]"
          >
            <Share2 className="h-4 w-4" strokeWidth={2} />
            Share profile
          </button>
        </div>
      </section>

      {/* Tabs — what you have saved is your own business, so only you see it. */}
      {isMe ? (
        <div className="qari-tabs mt-6" role="tablist" aria-label="Profile sections">
          {(
            [
              { id: 'audios' as const, label: 'Recitations', Icon: Mic },
              { id: 'favourites' as const, label: 'Favourites', Icon: Heart },
            ] as const
          ).map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className="qari-tab ed-focus"
            >
              <Icon className="h-4 w-4" strokeWidth={2} />
              {label}
            </button>
          ))}
          <span
            className="qari-tabs__ink"
            style={{ transform: `translateX(${tab === 'audios' ? '0%' : '100%'})` }}
            aria-hidden
          />
        </div>
      ) : (
        <div className="mt-6 flex items-center gap-3">
          <span className="ed-label">Recitations</span>
          <span className="ed-rule flex-1" />
        </div>
      )}

      <div className="mt-4">
        {listLoading ? (
          <div className="space-y-3">
            {[0, 1].map((i) => (
              <div key={i} className="ed-card h-[7.5rem] animate-pulse rounded-[1.5rem]" />
            ))}
          </div>
        ) : failed && tab === 'audios' ? (
          <p className="ed-card rounded-[1.5rem] p-6 text-center text-sm text-[var(--home-heading)]">
            Could not load this profile.
          </p>
        ) : list.length === 0 ? (
          <EmptyState tab={tab} isMe={isMe} />
        ) : (
          <div className="space-y-3">
            {list.map((recitation) => (
              <RecitationCard
                key={recitation.id}
                recitation={recitation}
                viewerId={viewer?.id ?? null}
                viewerUsername={viewer?.username ?? null}
                hideAuthor={tab === 'audios'}
                onRemoved={tab === 'audios' ? removeFromAudios : removeFromFavourites}
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

function Stat({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <span className="min-w-[5.5rem] px-1 py-1 text-center">
      <span className="ed-num flex items-center justify-center gap-1.5 text-[1.3rem] font-semibold leading-none text-[var(--home-heading)]">
        <span className="text-[var(--home-sage-deep)]">{icon}</span>
        {value}
      </span>
      <span className="mt-1.5 block text-[11px] text-[var(--home-muted)]">{label}</span>
    </span>
  )
}

function EmptyState({ tab, isMe }: { tab: Tab; isMe: boolean }) {
  const favourites = tab === 'favourites'
  return (
    <div className="ed-card rounded-[1.5rem] p-8 text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--home-sage-soft)] text-[var(--home-sage-deep)]">
        {favourites ? (
          <Heart className="h-7 w-7" strokeWidth={1.8} />
        ) : (
          <Mic className="h-7 w-7" strokeWidth={1.8} />
        )}
      </span>
      <p className="home-serif mt-4 text-[1.2rem] font-semibold text-[var(--home-heading)]">
        {favourites ? 'Nothing saved yet' : isMe ? 'No recitations yet' : 'Nothing published yet'}
      </p>
      <p className="mx-auto mt-1.5 max-w-[30ch] text-sm leading-relaxed text-[var(--home-muted)]">
        {favourites
          ? 'Tap the heart on a recitation and it will be waiting here.'
          : isMe
            ? 'Record a few ayahs and they will appear here.'
            : 'This qari hasn’t published anything yet.'}
      </p>
      {isMe && !favourites ? (
        <Link
          href="/qari/record"
          className="ed-ink ed-focus mt-5 inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold"
        >
          <Mic className="h-4 w-4" strokeWidth={2} />
          Record one
        </Link>
      ) : null}
    </div>
  )
}
