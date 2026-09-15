'use client'

import Link from 'next/link'
import { Fragment, memo, useCallback, useState } from 'react'
import { Lock, Play, Share2 } from 'lucide-react'
import LikeButton from '@/components/qari/LikeButton'
import PlayButton from '@/components/qari/PlayButton'
import QariAvatar from '@/components/qari/QariAvatar'
import RowMenu from '@/components/qari/RowMenu'
import ShareSheet from '@/components/qari/ShareSheet'
import Waveform from '@/components/qari/Waveform'
import { useQariPlayer } from '@/hooks/useQariPlayer'
import { tapFeedback } from '@/lib/haptics'
import {
  compactNumber,
  deleteRecitation,
  formatDuration,
  prefetchRecitationAudio,
  reportRecitation,
  timeAgo,
  type Recitation,
} from '@/lib/qari'
import { seekPlayback, togglePlayback } from '@/lib/qari-player'
import { findSheikh } from '@/lib/sheikhs'
import { cn } from '@/lib/cn'

interface RecitationCardProps {
  recitation: Recitation
  viewerId: string | null
  viewerUsername: string | null
  /** The list this card sits in, so playback carries on to the next one. */
  queue?: Recitation[]
  /** On a profile every card is by the same person, so who is left out. */
  hideAuthor?: boolean
  /** Position in the list, for the staggered entrance. */
  index?: number
  onRemoved?: (id: string) => void
  onNotice?: (message: string) => void
}

/**
 * One recitation as a compact card: who, what, its shape with play, then the
 * heart, plays, tags and share. The one playing is outlined and its shape
 * becomes the seek bar.
 */
function RecitationCard({
  recitation,
  viewerId,
  viewerUsername,
  queue,
  hideAuthor = false,
  index = 0,
  onRemoved,
  onNotice,
}: RecitationCardProps) {
  const player = useQariPlayer()
  const [shareOpen, setShareOpen] = useState(false)
  const [removing, setRemoving] = useState(false)

  const isCurrent = player.current?.id === recitation.id
  const status = isCurrent ? player.status : 'idle'
  const duration = isCurrent && player.duration > 0 ? player.duration : recitation.durationSec
  const progress = isCurrent && duration > 0 ? Math.min(1, player.position / duration) : 0
  const sheikh = findSheikh(recitation.imitating)
  const profileHref = `/qari/${encodeURIComponent(recitation.userUsername)}`
  const isOwner = Boolean(viewerId && viewerUsername && viewerUsername === recitation.userUsername)

  const toggle = useCallback(() => {
    tapFeedback()
    togglePlayback(recitation, { queue, viewerId })
  }, [queue, recitation, viewerId])

  const handleDelete = useCallback(async () => {
    if (!viewerId) return
    setRemoving(true)
    try {
      await deleteRecitation(recitation.id, viewerId)
      onRemoved?.(recitation.id)
      onNotice?.('Recitation deleted.')
    } catch {
      setRemoving(false)
      onNotice?.('Could not delete that recitation.')
    }
  }, [onNotice, onRemoved, recitation.id, viewerId])

  const handleReport = useCallback(async () => {
    if (!viewerId) {
      onNotice?.('Sign in to report a recitation.')
      return
    }
    try {
      await reportRecitation(recitation.id, viewerId, 'Reported from Qari')
      onNotice?.('Thank you. It has been sent for review.')
    } catch {
      onNotice?.('Could not send that report.')
    }
  }, [onNotice, recitation.id, viewerId])

  // Who (unless it is their own profile), when, then what it imitates.
  const sub: React.ReactNode[] = []
  if (!hideAuthor) {
    sub.push(
      <Link key="who" href={profileHref} className="ed-focus font-medium hover:text-[var(--home-heading)]">
        {recitation.userName}
      </Link>
    )
  }
  sub.push(<span key="when">{timeAgo(recitation.createdAt)}</span>)
  if (sheikh) {
    sub.push(
      <Link
        key="sheikh"
        href={`/qari/sheikh/${sheikh.id}`}
        className="ed-focus font-semibold text-[var(--home-sage-deep)] dark:text-[var(--home-sage)]"
      >
        Imitating {sheikh.shortName}
      </Link>
    )
  }
  const subLine = (
    <p className="truncate text-xs leading-4 text-[var(--home-muted)]">
      {sub.map((part, i) => (
        <Fragment key={i}>
          {i > 0 ? ' · ' : null}
          {part}
        </Fragment>
      ))}
    </p>
  )

  const title = (
    <p
      className={cn(
        'flex min-w-0 items-center gap-1.5 text-[15.5px] font-semibold leading-5 tracking-[-0.005em] transition-colors',
        isCurrent ? 'text-[var(--home-sage-deep)] dark:text-[var(--home-sage)]' : 'text-[var(--home-heading)]'
      )}
    >
      {recitation.isPrivate ? (
        <Lock className="h-3.5 w-3.5 shrink-0 text-[var(--home-muted)]" strokeWidth={2.4} aria-label="Only you" />
      ) : null}
      <span className="truncate">{recitation.title}</span>
    </p>
  )

  const menu = (
    <RowMenu isOwner={isOwner} onReport={() => void handleReport()} onDelete={() => void handleDelete()} />
  )

  return (
    <article
      data-recitation={recitation.id}
      className={cn(
        'qari-card qari-enter px-3 pb-1 pt-2.5 transition-opacity',
        isCurrent && 'is-current',
        removing && 'pointer-events-none opacity-50'
      )}
      style={{ animationDelay: `${Math.min(index, 10) * 35}ms` }}
      onPointerDown={() => void prefetchRecitationAudio(recitation.id)}
    >
      <div className={cn('flex items-center gap-2.5', hideAuthor && 'pl-0.5')}>
        {hideAuthor ? null : (
          <Link
            href={profileHref}
            aria-label={`${recitation.userName}’s profile`}
            className="qari-press ed-focus shrink-0 rounded-full"
          >
            <QariAvatar username={recitation.userUsername} name={recitation.userName} size={36} />
          </Link>
        )}
        <div className="min-w-0 flex-1">
          {title}
          <div className="mt-px">{subLine}</div>
        </div>
        <div className="-mr-1.5 self-start">{menu}</div>
      </div>

      {recitation.caption && isCurrent ? (
        <p className="qari-enter mt-1 line-clamp-2 pl-0.5 text-[12.5px] leading-snug text-[var(--home-muted)]">
          {recitation.caption}
        </p>
      ) : null}

      <div className="qari-card__strip mt-2 flex items-center gap-2.5 py-1.5 pl-1.5 pr-3">
        <PlayButton status={status} onClick={toggle} label={recitation.title} size={34} />
        <Waveform
          peaks={recitation.peaks}
          seed={recitation.id}
          progress={progress}
          bars={36}
          onSeek={isCurrent ? seekPlayback : undefined}
          className="h-7 min-w-0 flex-1"
          label={`Position in ${recitation.title}`}
        />
        <span className="shrink-0 text-[11.5px] tabular-nums text-[var(--home-muted)]">
          {isCurrent && player.position > 0 ? formatDuration(player.position) : formatDuration(duration)}
        </span>
      </div>

      <div className="flex h-9 items-center gap-0.5 text-[var(--home-muted)]">
        <LikeButton recitation={recitation} viewerId={viewerId} onNotice={onNotice} compact />
        {recitation.playCount > 0 ? (
          <span
            className="flex h-8 items-center gap-1 px-1.5 text-xs font-semibold tabular-nums"
            aria-label={`${recitation.playCount} plays`}
          >
            <Play className="h-3 w-3 fill-current" strokeWidth={0} />
            {compactNumber(recitation.playCount)}
          </span>
        ) : null}
        <div className="flex min-w-0 flex-1 gap-1 overflow-hidden pl-1">
          {recitation.hashtags.slice(0, 2).map((tag) => (
            <Link key={tag} href={`/qari?q=${encodeURIComponent(`#${tag}`)}`} className="qari-chip qari-press ed-focus">
              #{tag}
            </Link>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            tapFeedback()
            setShareOpen(true)
          }}
          aria-label="Share"
          className="qari-press ed-focus -mr-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors hover:text-[var(--home-heading)]"
        >
          <Share2 className="h-[17px] w-[17px]" strokeWidth={2} />
        </button>
      </div>

      <ShareSheet recitation={recitation} open={shareOpen} onClose={() => setShareOpen(false)} onNotice={onNotice} />
    </article>
  )
}

export default memo(RecitationCard)

/** Cards in a column, a little apart. */
export function RecitationCards({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-2.5">{children}</div>
}

/** Card-shaped placeholders while a list loads. */
export function RecitationSkeletons({ count = 4 }: { count?: number }) {
  return (
    <RecitationCards>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="qari-card px-3 pb-3 pt-2.5" aria-hidden>
          <div className="flex items-center gap-2.5">
            <span className="qari-skeleton h-9 w-9 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <span className="qari-skeleton block h-3.5 w-3/5 rounded-full" />
              <span className="qari-skeleton block h-2.5 w-24 rounded-full" />
            </div>
          </div>
          <span className="qari-skeleton mt-2.5 block h-[46px] rounded-xl" />
        </div>
      ))}
    </RecitationCards>
  )
}
