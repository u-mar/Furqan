'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { Camera, Heart, Mic, Play, Trash2 } from 'lucide-react'
import RecitationCard from '@/components/qari/RecitationCard'
import QariAvatar, { removeAvatar, uploadAvatar } from '@/components/qari/QariAvatar'
import { Notice, QariHeader, QariScreen, useNotice, useViewer } from '@/components/qari/QariShell'
import { fetchFeed, type Recitation } from '@/lib/qari'

export default function QariProfilePage() {
  const params = useParams<{ username: string }>()
  const username = decodeURIComponent(String(params?.username ?? ''))
  const viewer = useViewer()
  const { notice, setNotice } = useNotice()

  const [items, setItems] = useState<Recitation[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!username) return
    let cancelled = false

    void (async () => {
      setLoading(true)
      setFailed(false)
      try {
        const page = await fetchFeed({ user: username, viewerId: viewer?.id ?? null })
        if (!cancelled) setItems(page.items)
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

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((r) => r.id !== id))
  }, [])

  const displayName = items[0]?.userName || viewer?.name || username
  const totalPlays = items.reduce((sum, r) => sum + r.playCount, 0)
  const totalLikes = items.reduce((sum, r) => sum + r.likeCount, 0)
  // Usernames are stored lower-case; a link may arrive with any casing.
  const isMe = viewer?.username.toLowerCase() === username.toLowerCase()

  /* Avatar */
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [avatarVersion, setAvatarVersion] = useState<number | undefined>(undefined)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [hasAvatar, setHasAvatar] = useState(false)

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

  const handleAvatarPick = useCallback(
    async (file: File) => {
      if (!viewer) return
      setUploadingAvatar(true)
      try {
        await uploadAvatar(file, viewer)
        setAvatarVersion(Date.now())
        setNotice('Profile picture updated.')
      } catch (err) {
        setNotice(err instanceof Error ? err.message : 'Could not save that picture.')
      } finally {
        setUploadingAvatar(false)
      }
    },
    [setNotice, viewer]
  )

  const handleAvatarRemove = useCallback(async () => {
    if (!viewer) return
    try {
      await removeAvatar(viewer)
      setAvatarVersion(Date.now())
      setNotice('Picture removed.')
    } catch {
      setNotice('Could not remove that picture.')
    }
  }, [setNotice, viewer])

  return (
    <QariScreen>
      <QariHeader eyebrow="Qari" title="Profile" backHref="/qari" />

      <section className="ed-card mb-5 rounded-[1.5rem] p-5 text-center">
        <div className="relative mx-auto w-fit">
          <QariAvatar
            username={username}
            name={displayName}
            size={88}
            version={avatarVersion}
            className="mx-auto"
          />
          {isMe ? (
            <>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploadingAvatar}
                aria-label="Change profile picture"
                className="ed-focus absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full border-2 border-[var(--home-card-bg)] bg-[var(--home-sage-deep)] text-white transition-transform active:scale-95 disabled:opacity-60"
              >
                {uploadingAvatar ? (
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <Camera className="h-[16px] w-[16px]" strokeWidth={2} />
                )}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ''
                  if (file) void handleAvatarPick(file)
                }}
              />
            </>
          ) : null}
        </div>

        <h2 className="home-serif mt-3 truncate text-[1.5rem] font-semibold leading-tight text-[var(--home-heading)]">
          {displayName}
        </h2>
        <p className="mt-0.5 text-sm text-[var(--home-muted)]">@{username}</p>

        {isMe && hasAvatar ? (
          <button
            type="button"
            onClick={() => void handleAvatarRemove()}
            className="ed-focus mx-auto mt-2 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold text-[var(--home-muted)] transition-colors hover:text-rose-500"
          >
            <Trash2 className="h-3 w-3" strokeWidth={2} />
            Remove picture
          </button>
        ) : null}

        <div className="mt-4 flex items-center justify-center gap-6">
          <span className="text-xs text-[var(--home-muted)]">
            <span className="ed-num flex items-center justify-center gap-1 text-[1.15rem] font-semibold text-[var(--home-heading)]">
              <Mic className="h-4 w-4 text-[var(--home-sage-deep)]" strokeWidth={2} />
              {items.length}
            </span>
            recitations
          </span>
          <span className="h-8 w-px bg-[var(--home-rule)]" />
          <span className="text-xs text-[var(--home-muted)]">
            <span className="ed-num flex items-center justify-center gap-1 text-[1.15rem] font-semibold text-[var(--home-heading)]">
              <Play className="h-4 w-4 text-[var(--home-sage-deep)]" strokeWidth={2} />
              {totalPlays}
            </span>
            plays
          </span>
          <span className="h-8 w-px bg-[var(--home-rule)]" />
          <span className="text-xs text-[var(--home-muted)]">
            <span className="ed-num flex items-center justify-center gap-1 text-[1.15rem] font-semibold text-[var(--home-heading)]">
              <Heart className="h-4 w-4 text-rose-500" strokeWidth={2} />
              {totalLikes}
            </span>
            loved
          </span>
        </div>
      </section>

      {loading ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="ed-card h-[7.5rem] animate-pulse rounded-[1.5rem]" />
          ))}
        </div>
      ) : failed ? (
        <p className="ed-card rounded-[1.5rem] p-6 text-center text-sm text-[var(--home-heading)]">
          Could not load this profile.
        </p>
      ) : items.length === 0 ? (
        <p className="ed-card rounded-[1.5rem] p-8 text-center text-sm leading-relaxed text-[var(--home-muted)]">
          {isMe
            ? 'You haven’t published a recitation yet.'
            : 'This qari hasn’t published anything yet.'}
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((recitation) => (
            <RecitationCard
              key={recitation.id}
              recitation={recitation}
              viewerId={viewer?.id ?? null}
              viewerUsername={viewer?.username ?? null}
              hideAuthor
              onRemoved={removeItem}
              onNotice={setNotice}
            />
          ))}
        </div>
      )}

      <Notice message={notice} />
    </QariScreen>
  )
}
