'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Flag, Heart, Lock, Pause, Play, Share2, Trash2 } from 'lucide-react'
import QariAvatar from '@/components/qari/QariAvatar'
import { cn } from '@/lib/cn'
import {
  countPlay,
  deleteRecitation,
  formatDuration,
  prefetchRecitationAudio,
  recitationAudioUrl,
  reportRecitation,
  shareRecitation,
  timeAgo,
  toggleLike,
  type Recitation,
} from '@/lib/qari'

interface RecitationCardProps {
  recitation: Recitation
  viewerId: string | null
  /** The signed-in user's username — the feed never exposes author ids. */
  viewerUsername: string | null
  /** Profile pages already show whose recitations these are. */
  hideAuthor?: boolean
  onRemoved?: (id: string) => void
  onNotice?: (message: string) => void
}

export default function RecitationCard({
  recitation,
  viewerId,
  viewerUsername,
  hideAuthor,
  onRemoved,
  onNotice,
}: RecitationCardProps) {
  const [liked, setLiked] = useState(recitation.liked)
  const [likeCount, setLikeCount] = useState(recitation.likeCount)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [loading, setLoading] = useState(false)
  const [sharing, setSharing] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const countedRef = useRef(false)

  const isOwner = Boolean(
    viewerId && viewerUsername && viewerUsername === recitation.userUsername
  )

  // The feed loads once before the signed-in viewer resolves, so a card can
  // be told it is liked only on the second pass — after useState has already
  // captured `false`. Follow the prop when the server's answer changes.
  useEffect(() => {
    setLiked(recitation.liked)
    setLikeCount(recitation.likeCount)
  }, [recitation.liked, recitation.likeCount])

  useEffect(() => {
    return () => {
      audioRef.current?.pause()
      audioRef.current = null
    }
  }, [])

  const togglePlay = useCallback(() => {
    if (playing) {
      audioRef.current?.pause()
      return
    }

    if (!audioRef.current) {
      const audio = new Audio(recitationAudioUrl(recitation.id))
      audio.preload = 'none'
      audio.addEventListener('play', () => setPlaying(true))
      audio.addEventListener('pause', () => setPlaying(false))
      audio.addEventListener('ended', () => {
        setPlaying(false)
        setProgress(0)
      })
      audio.addEventListener('timeupdate', () => {
        const total = audio.duration || recitation.durationSec
        if (total > 0) setProgress(Math.min(1, audio.currentTime / total))
      })
      audio.addEventListener('waiting', () => setLoading(true))
      audio.addEventListener('playing', () => setLoading(false))
      audio.addEventListener('error', () => {
        setLoading(false)
        onNotice?.('That recitation could not be played.')
      })
      audioRef.current = audio
    }

    setLoading(true)
    void audioRef.current
      .play()
      .then(() => {
        setLoading(false)
        if (!countedRef.current) {
          countedRef.current = true
          void countPlay(recitation.id, viewerId)
        }
      })
      .catch(() => {
        setLoading(false)
        onNotice?.('That recitation could not be played.')
      })
  }, [playing, recitation.id, recitation.durationSec, onNotice, viewerId])

  const handleLike = useCallback(async () => {
    if (!viewerId) {
      onNotice?.('Sign in to save recitations you love.')
      return
    }
    // Optimistic — the heart should never feel laggy.
    const nextLiked = !liked
    setLiked(nextLiked)
    setLikeCount((n) => Math.max(0, n + (nextLiked ? 1 : -1)))
    try {
      const result = await toggleLike(recitation.id, viewerId, liked)
      setLiked(result.liked)
      setLikeCount(result.likeCount)
    } catch {
      setLiked(liked)
      setLikeCount(recitation.likeCount)
    }
  }, [liked, onNotice, recitation.id, recitation.likeCount, viewerId])

  const handleShare = useCallback(async () => {
    // The recording has to be downloaded before it can be handed over, and
    // that is not instant — say so rather than looking dead.
    setSharing(true)
    try {
      const result = await shareRecitation(recitation)
      if (result === 'copied') onNotice?.('Link copied.')
    } catch {
      onNotice?.('Could not share that one.')
    } finally {
      setSharing(false)
    }
  }, [recitation, onNotice])

  const handleDelete = useCallback(async () => {
    if (!viewerId) return
    try {
      await deleteRecitation(recitation.id, viewerId)
      onRemoved?.(recitation.id)
    } catch {
      onNotice?.('Could not delete that recitation.')
    }
  }, [onNotice, onRemoved, recitation.id, viewerId])

  const handleReport = useCallback(async () => {
    if (!viewerId) {
      onNotice?.('Sign in to report a recitation.')
      return
    }
    try {
      await reportRecitation(recitation.id, viewerId, 'Reported from the feed')
      onNotice?.('Thank you — this has been sent for review.')
    } catch {
      onNotice?.('Could not send that report.')
    }
  }, [onNotice, recitation.id, viewerId])

  return (
    <article
      className={cn(
        'ed-card rounded-[1.35rem] p-3.5 transition-shadow',
        playing && 'qari-card-playing'
      )}
    >
      <div className="flex items-center gap-3">
        {/* Who — a way to their profile, not a control. Left out on a
            profile page, where it would be the same face on every row. */}
        {!hideAuthor ? (
          <Link
            href={`/qari/${encodeURIComponent(recitation.userUsername)}`}
            aria-label={`${recitation.userName}’s profile`}
            className="ed-focus shrink-0 rounded-full transition-transform active:scale-95"
          >
            <QariAvatar
              username={recitation.userUsername}
              name={recitation.userName}
              size={48}
            />
          </Link>
        ) : null}

        {/* What */}
        <div className="min-w-0 flex-1">
          <p className="home-serif flex items-center gap-1.5 truncate text-[1rem] font-semibold leading-tight text-[var(--home-heading)]">
            {recitation.isPrivate ? (
              <Lock
                className="h-[13px] w-[13px] shrink-0 text-[var(--home-muted)]"
                strokeWidth={2.4}
                aria-label="Private"
              />
            ) : null}
            <span className="truncate">{recitation.title}</span>
          </p>
          {!hideAuthor ? (
            <Link
              href={`/qari/${encodeURIComponent(recitation.userUsername)}`}
              className="ed-focus mt-0.5 block truncate text-[0.84rem] leading-snug text-[var(--home-muted)] hover:text-[var(--home-heading)] hover:underline"
            >
              {recitation.userName}
            </Link>
          ) : null}
        </div>

        {/* Play, where a thumb lands. */}
        <button
          type="button"
          onClick={togglePlay}
          aria-label={playing ? 'Pause' : 'Play'}
          className={cn(
            'ed-focus relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition-transform active:scale-95',
            playing ? 'bg-[var(--home-sage-deep)] text-white' : 'ed-ink'
          )}
        >
          {playing ? (
            <>
              <span className="qari-ring" aria-hidden />
              <span className="qari-ring qari-ring-late" aria-hidden />
            </>
          ) : null}
          {loading ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : playing ? (
            <Pause className="h-5 w-5 fill-current" />
          ) : (
            <Play className="ml-0.5 h-5 w-5 fill-current" />
          )}
        </button>
      </div>

      {recitation.caption ? (
        <p className="mt-2.5 line-clamp-2 text-[0.82rem] leading-snug text-[var(--home-muted)]">
          {recitation.caption}
        </p>
      ) : null}

      {recitation.hashtags.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {recitation.hashtags.map((tag) => (
            <Link
              key={tag}
              href={`/qari?q=${encodeURIComponent(`#${tag}`)}`}
              className="qari-tag ed-focus"
            >
              #{tag}
            </Link>
          ))}
        </div>
      ) : null}

      {/* Progress */}
      <div className="mt-3 flex items-center gap-2">
        <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-[var(--home-track)]">
          <div
            className="h-full rounded-full bg-[var(--home-sage-deep)] transition-[width] duration-150"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        {playing ? (
          <span className="flex h-3 shrink-0 items-end gap-[2px]" aria-hidden>
            {[0, 0.18, 0.09, 0.26].map((delay, i) => (
              <span key={i} className="qari-eq-bar" style={{ animationDelay: `${delay}s` }} />
            ))}
          </span>
        ) : null}
        <span className="ed-num shrink-0 text-[11px] text-[var(--home-muted)]">
          {formatDuration(recitation.durationSec)}
        </span>
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-[var(--home-rule)] pt-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => void handleLike()}
            aria-pressed={liked}
            aria-label={liked ? 'Remove from favourites' : 'Add to favourites'}
            className={cn(
              'ed-focus flex h-9 items-center gap-1.5 rounded-full px-2.5 text-[0.78rem] font-semibold transition-colors',
              liked ? 'text-rose-500' : 'text-[var(--home-muted)] hover:text-[var(--home-heading)]'
            )}
          >
            <Heart className={cn('h-[17px] w-[17px]', liked && 'fill-current')} strokeWidth={2} />
            {likeCount > 0 ? likeCount : ''}
          </button>

          <button
            type="button"
            onClick={() => void handleShare()}
            // Start the download on the press so the recording is usually in
            // hand by the time the tap completes.
            onPointerDown={() => void prefetchRecitationAudio(recitation.id)}
            disabled={sharing}
            aria-label={sharing ? 'Preparing the recording' : 'Share'}
            className="ed-focus flex h-9 items-center gap-1.5 rounded-full px-2.5 text-[0.78rem] font-semibold text-[var(--home-muted)] transition-colors hover:text-[var(--home-heading)] disabled:opacity-70"
          >
            {sharing ? (
              <span className="h-[15px] w-[15px] animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <Share2 className="h-[17px] w-[17px]" strokeWidth={2} />
            )}
          </button>
        </div>

        <div className="flex items-center gap-1">
          <span className="mr-1 text-[11px] text-[var(--home-muted)]">
            {recitation.playCount > 0 ? `${recitation.playCount} plays · ` : ''}
            {timeAgo(recitation.createdAt)}
          </span>
          {isOwner ? (
            <button
              type="button"
              onClick={() => void handleDelete()}
              aria-label="Delete recitation"
              className="ed-focus flex h-9 w-9 items-center justify-center rounded-full text-[var(--home-muted)] transition-colors hover:text-rose-500"
            >
              <Trash2 className="h-[16px] w-[16px]" strokeWidth={2} />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleReport()}
              aria-label="Report recitation"
              className="ed-focus flex h-9 w-9 items-center justify-center rounded-full text-[var(--home-muted)] transition-colors hover:text-[var(--home-heading)]"
            >
              <Flag className="h-[15px] w-[15px]" strokeWidth={2} />
            </button>
          )}
        </div>
      </div>
    </article>
  )
}
