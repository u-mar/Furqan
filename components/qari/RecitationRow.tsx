'use client'

import Link from 'next/link'
import { Fragment, useCallback, useState } from 'react'
import { Lock, Share2 } from 'lucide-react'
import LikeButton from '@/components/qari/LikeButton'
import PlayButton from '@/components/qari/PlayButton'
import QariAvatar from '@/components/qari/QariAvatar'
import RowMenu from '@/components/qari/RowMenu'
import ShareSheet from '@/components/qari/ShareSheet'
import Waveform from '@/components/qari/Waveform'
import { useQariPlayer } from '@/hooks/useQariPlayer'
import { tapFeedback } from '@/lib/haptics'
import {
  deleteRecitation,
  formatDuration,
  prefetchRecitationAudio,
  reportRecitation,
  type Recitation,
} from '@/lib/qari'
import { seekPlayback, togglePlayback } from '@/lib/qari-player'
import { findSheikh } from '@/lib/sheikhs'
import { cn } from '@/lib/cn'

interface RecitationRowProps {
  recitation: Recitation
  viewerId: string | null
  viewerUsername: string | null
  /** The list this row sits in, so playback carries on to the next one. */
  queue?: Recitation[]
  /** On a profile every row is by the same person, so the name is left out. */
  hideAuthor?: boolean
  /** Position in the list, for the staggered entrance. */
  index?: number
  onRemoved?: (id: string) => void
  onNotice?: (message: string) => void
}

/**
 * One slim row per recitation: who, what, a heart and play. The one playing
 * opens up underneath with its waveform, time, share and more.
 */
export default function RecitationRow({
  recitation,
  viewerId,
  viewerUsername,
  queue,
  hideAuthor = false,
  index = 0,
  onRemoved,
  onNotice,
}: RecitationRowProps) {
  const player = useQariPlayer()
  const [shareOpen, setShareOpen] = useState(false)

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
    try {
      await deleteRecitation(recitation.id, viewerId)
      onRemoved?.(recitation.id)
      onNotice?.('Recitation deleted.')
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
      await reportRecitation(recitation.id, viewerId, 'Reported from Qari')
      onNotice?.('Thank you. It has been sent for review.')
    } catch {
      onNotice?.('Could not send that report.')
    }
  }, [onNotice, recitation.id, viewerId])

  // Name, length, plays on a profile, then what it imitates and its tags.
  const meta: React.ReactNode[] = []
  if (!hideAuthor) {
    meta.push(
      <Link key="who" href={profileHref} className="ed-focus hover:text-[var(--home-heading)]">
        {recitation.userName}
      </Link>
    )
  }
  meta.push(<span key="len">{formatDuration(recitation.durationSec)}</span>)
  if (hideAuthor && recitation.playCount > 0) {
    meta.push(
      <span key="plays">
        {recitation.playCount} {recitation.playCount === 1 ? 'play' : 'plays'}
      </span>
    )
  }
  if (sheikh) {
    meta.push(
      <Link key="sheikh" href={`/qari/sheikh/${sheikh.id}`} className="ed-focus text-[var(--home-sage)]">
        Imitating {sheikh.shortName}
      </Link>
    )
  }
  if (recitation.hashtags.length > 0) {
    meta.push(
      <span key="tags">
        {recitation.hashtags.map((tag, i) => (
          <Fragment key={tag}>
            {i > 0 ? ' ' : null}
            <Link
              href={`/qari?q=${encodeURIComponent(`#${tag}`)}`}
              className="ed-focus text-[var(--home-sage)]"
            >
              #{tag}
            </Link>
          </Fragment>
        ))}
      </span>
    )
  }

  return (
    <article
      className={cn(
        'qari-row qari-enter -mx-3 px-3',
        isCurrent && 'is-current',
        // Hairline between rows, starting under the text like a settings list.
        "after:absolute after:bottom-0 after:left-[68px] after:right-3 after:h-px after:bg-[var(--home-rule)] after:content-[''] last:after:hidden",
        isCurrent && 'after:hidden'
      )}
      style={{ animationDelay: `${Math.min(index, 10) * 35}ms` }}
    >
      <div className="flex items-center gap-3 py-2.5">
        {hideAuthor ? (
          <QariAvatar username={recitation.userUsername} name={recitation.userName} size={44} />
        ) : (
          <Link
            href={profileHref}
            aria-label={`${recitation.userName}’s profile`}
            className="qari-press ed-focus shrink-0 rounded-full"
          >
            <QariAvatar username={recitation.userUsername} name={recitation.userName} size={44} />
          </Link>
        )}

        <div
          className="min-w-0 flex-1 cursor-pointer"
          onClick={(e) => {
            if ((e.target as HTMLElement).closest('a,button')) return
            toggle()
          }}
          onPointerDown={() => void prefetchRecitationAudio(recitation.id)}
        >
          <p
            className={cn(
              'flex items-center gap-1.5 text-[15px] font-semibold leading-5 transition-colors',
              isCurrent ? 'text-[var(--home-sage)]' : 'text-[var(--home-heading)]'
            )}
          >
            {recitation.isPrivate ? (
              <Lock className="h-3.5 w-3.5 shrink-0 text-[var(--home-muted)]" strokeWidth={2.4} aria-label="Only you" />
            ) : null}
            <span className="truncate">{recitation.title}</span>
          </p>
          <p className="mt-0.5 truncate text-[13px] leading-[18px] text-[var(--home-muted)]">
            {meta.map((part, i) => (
              <Fragment key={i}>
                {i > 0 ? ' · ' : null}
                {part}
              </Fragment>
            ))}
          </p>
          {isCurrent && recitation.caption ? (
            <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-[var(--home-muted)]">
              {recitation.caption}
            </p>
          ) : null}
        </div>

        <LikeButton recitation={recitation} viewerId={viewerId} onNotice={onNotice} />
        <PlayButton status={status} onClick={toggle} label={recitation.title} />
      </div>

      {isCurrent ? (
        <div className="qari-enter flex items-center gap-2 pb-3 pl-14">
          <Waveform
            peaks={recitation.peaks}
            seed={recitation.id}
            progress={progress}
            bars={32}
            onSeek={seekPlayback}
            className="h-8 min-w-0 flex-1"
            label={`Position in ${recitation.title}`}
          />
          <span className="shrink-0 text-[11px] tabular-nums text-[var(--home-muted)]">
            {formatDuration(isCurrent ? player.position : 0)} / {formatDuration(duration)}
          </span>
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            aria-label="Share"
            className="ed-focus flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--home-muted)] transition-colors hover:text-[var(--home-heading)]"
          >
            <Share2 className="h-[17px] w-[17px]" strokeWidth={2} />
          </button>
          <RowMenu
            isOwner={isOwner}
            onReport={() => void handleReport()}
            onDelete={() => void handleDelete()}
          />
        </div>
      ) : null}

      <ShareSheet
        recitation={recitation}
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        onNotice={onNotice}
      />
    </article>
  )
}
