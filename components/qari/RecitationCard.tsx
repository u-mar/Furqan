'use client'

import Link from 'next/link'
import { memo, useCallback } from 'react'
import { Headphones, ImageIcon, Lock, Share2 } from 'lucide-react'
import LikeButton from '@/components/qari/LikeButton'
import PlayButton from '@/components/qari/PlayButton'
import QariAvatar from '@/components/qari/QariAvatar'
import ReportReasonSheet from '@/components/qari/ReportReasonSheet'
import RowMenu from '@/components/qari/RowMenu'
import ShareSheet from '@/components/qari/ShareSheet'
import Waveform from '@/components/qari/Waveform'
import { useQariPlayer } from '@/hooks/useQariPlayer'
import { useRecitationActions } from '@/hooks/useRecitationActions'
import { tapFeedback } from '@/lib/haptics'
import { compactNumber, formatDuration, prefetchRecitationAudio, timeAgoLong, type Recitation } from '@/lib/qari'
import { seekPlayback, togglePlayback } from '@/lib/qari-player'
import { findSheikh } from '@/lib/sheikhs'
import { cn } from '@/lib/cn'
import { useT } from '@/lib/i18n'

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
  /** Its visibility changed rather than being deleted — the parent list decides what that means for it. */
  onUpdated?: (id: string, patch: Partial<Recitation>) => void
  onNotice?: (message: string) => void
  /** Opens this recitation in the full-screen swipe view. Without it, tapping the card plays it. */
  onOpen?: (recitation: Recitation) => void
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
  onUpdated,
  onNotice,
  onOpen,
}: RecitationCardProps) {
  const t = useT()
  const player = useQariPlayer()
  const {
    isOwner,
    isPrivate,
    removing,
    shareOpen,
    setShareOpen,
    reportOpen,
    setReportOpen,
    handleDelete,
    handleTogglePrivacy,
    handleReportTap,
    handleReportReason,
    handleBlock,
  } = useRecitationActions({ recitation, viewerId, viewerUsername, onRemoved, onUpdated, onNotice })

  const isCurrent = player.current?.id === recitation.id
  const status = isCurrent ? player.status : 'idle'
  const duration = isCurrent && player.duration > 0 ? player.duration : recitation.durationSec
  const progress = isCurrent && duration > 0 ? Math.min(1, player.position / duration) : 0
  const sheikh = findSheikh(recitation.imitating)
  const profileHref = `/qari/${encodeURIComponent(recitation.userUsername)}`

  const toggle = useCallback(() => {
    tapFeedback()
    togglePlayback(recitation, { queue, viewerId })
  }, [queue, recitation, viewerId])

  const firstTag = recitation.hashtags[0]
  const isAyahCard = recitation.kind === 'ayah'

  // A tap on empty card space opens it full screen (or plays it, where there is no
  // full-screen view); links, buttons, the waveform and anything portaled out of the
  // card (the sheets) keep their own behaviour.
  const onCardClick = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      const target = event.target as HTMLElement
      if (!event.currentTarget.contains(target)) return
      if (target.closest('a, button, input, [role="slider"], [role="dialog"]')) return
      if (onOpen) {
        tapFeedback()
        onOpen(recitation)
      } else {
        toggle()
      }
    },
    [onOpen, recitation, toggle]
  )

  const title = (
    <h3 className="home-serif flex min-w-0 items-center gap-1.5 text-[17px] font-medium leading-snug tracking-[-0.01em] text-[var(--home-heading)]">
      {isPrivate ? (
        <Lock className="h-3.5 w-3.5 shrink-0 text-[var(--home-muted)]" strokeWidth={2.4} aria-label={t('Only you')} />
      ) : null}
      <span className="truncate">{recitation.title}</span>
    </h3>
  )

  const menu = (
    <RowMenu
      isOwner={isOwner}
      isPrivate={isPrivate}
      onTogglePrivacy={isOwner ? () => void handleTogglePrivacy() : undefined}
      onReport={handleReportTap}
      onDelete={() => void handleDelete()}
      blockUsername={recitation.userUsername}
      onBlock={() => void handleBlock()}
    />
  )

  return (
    <article
      data-recitation={recitation.id}
      className={cn(
        'qari-card qari-enter px-3.5 pb-2 pt-3 transition-opacity',
        isCurrent && 'is-current',
        removing && 'pointer-events-none opacity-50'
      )}
      style={{ animationDelay: `${Math.min(index, 10) * 35}ms` }}
      onPointerDown={() => {
        if (!isAyahCard) void prefetchRecitationAudio(recitation.id)
      }}
      onClick={onCardClick}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">{title}</div>
        <div className="-mr-2 -mt-1.5 shrink-0">{menu}</div>
      </div>

      {isAyahCard ? (
        // An ayah card: the picture itself, with what its poster said beside it.
        <div className="mt-2 flex gap-3">
          {recitation.imageUrl ? (
            <img
              src={recitation.imageUrl}
              alt={t('Ayah card for {verseKey}', { verseKey: recitation.verseKey ?? '' })}
              loading="lazy"
              decoding="async"
              className="aspect-[4/5] w-[5.5rem] shrink-0 rounded-xl bg-[var(--home-track)] object-cover shadow-[0_8px_20px_-12px_rgba(0,0,0,0.5)]"
            />
          ) : null}
          <div className="min-w-0 flex-1 pt-0.5">
            <span className="qari-chip" style={{ height: '1.625rem', paddingInline: '0.5625rem', fontSize: '0.75rem' }}>
              <ImageIcon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
              {t('Ayah card')}
            </span>
            {recitation.caption ? (
              <p className="mt-2 line-clamp-3 text-[13px] leading-snug text-[var(--home-heading)]">{recitation.caption}</p>
            ) : null}
            {firstTag ? (
              <Link href={`/qari?q=${encodeURIComponent(`#${firstTag}`)}`} className="qari-chip qari-press ed-focus mt-2">
                #{firstTag}
              </Link>
            ) : null}
          </div>
        </div>
      ) : (
        <>
          {sheikh || firstTag ? (
            <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-1.5">
              {sheikh ? (
                <Link href={`/qari/sheikh/${sheikh.id}`} className="qari-chip qari-chip--gold qari-press ed-focus">
                  {t('Imitating')} {sheikh.shortName}
                </Link>
              ) : null}
              {firstTag ? (
                <Link href={`/qari?q=${encodeURIComponent(`#${firstTag}`)}`} className="qari-chip qari-press ed-focus">
                  #{firstTag}
                </Link>
              ) : null}
            </div>
          ) : null}

          <div className="mt-2.5 flex items-center gap-2.5">
            <PlayButton status={status} onClick={toggle} label={recitation.title} size={30} />
            <Waveform
              peaks={recitation.peaks}
              seed={recitation.id}
              progress={progress}
              bars={36}
              onSeek={isCurrent ? seekPlayback : undefined}
              className="h-[26px] min-w-0 flex-1"
              label={t('Position in {title}', { title: recitation.title })}
            />
            <span className="shrink-0 text-[11px] tabular-nums text-[var(--home-muted)]">
              {isCurrent && player.position > 0 ? formatDuration(player.position) : formatDuration(duration)}
            </span>
          </div>

          {recitation.caption && isCurrent ? (
            <p className="qari-enter mt-2 line-clamp-2 text-[12.5px] leading-snug text-[var(--home-muted)]">
              {recitation.caption}
            </p>
          ) : null}
        </>
      )}

      <div className="mt-1.5 flex h-8 items-center gap-1 text-[11px] text-[var(--home-muted)]">
        {hideAuthor ? null : (
          <Link
            href={profileHref}
            aria-label={t('{userName}’s profile', { userName: recitation.userName })}
            className="qari-press ed-focus shrink-0 rounded-full"
          >
            <QariAvatar username={recitation.userUsername} name={recitation.userName} size={20} />
          </Link>
        )}
        <p className={cn('min-w-0 flex-1 truncate', !hideAuthor && 'pl-1')}>
          {hideAuthor ? null : (
            <>
              <Link href={profileHref} className="ed-focus font-medium hover:text-[var(--home-heading)]">
                {recitation.userName}
              </Link>
              {' · '}
            </>
          )}
          {timeAgoLong(recitation.createdAt)}
        </p>
        <LikeButton recitation={recitation} viewerId={viewerId} onNotice={onNotice} compact />
        {recitation.playCount > 0 ? (
          // Headphones, not a play triangle — a triangle here read as a second play button.
          <span
            className="flex shrink-0 items-center gap-1 px-1 tabular-nums"
            aria-label={t('{playCount} plays', { playCount: recitation.playCount })}
          >
            <Headphones className="h-[15px] w-[15px]" strokeWidth={1.9} aria-hidden />
            {compactNumber(recitation.playCount)}
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => {
            tapFeedback()
            setShareOpen(true)
          }}
          aria-label={t('Share')}
          className="qari-press ed-focus relative -mr-2 ml-0.5 flex h-8 w-9 shrink-0 items-center justify-center rounded-full transition-colors before:absolute before:-inset-y-1 before:inset-x-0 before:content-[''] hover:text-[var(--home-heading)]"
        >
          <Share2 className="h-[16px] w-[16px]" strokeWidth={2} />
        </button>
      </div>

      <ShareSheet recitation={recitation} open={shareOpen} onClose={() => setShareOpen(false)} onNotice={onNotice} />
      <ReportReasonSheet open={reportOpen} onClose={() => setReportOpen(false)} onPick={(reason) => void handleReportReason(reason)} />
    </article>
  )
}

export default memo(RecitationCard)

/** Cards in a column, a little apart. */
export function RecitationCards({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-2.5">{children}</div>
}

/** Card-shaped placeholders while a list loads: title, waveform row, meta line. */
export function RecitationSkeletons({ count = 4 }: { count?: number }) {
  return (
    <RecitationCards>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="qari-card px-3.5 pb-3 pt-3.5" aria-hidden>
          <span className="qari-skeleton block h-[18px] w-3/5 rounded-full" />
          <div className="mt-3 flex items-center gap-2.5">
            <span className="qari-skeleton h-[30px] w-[30px] shrink-0 rounded-full" />
            <span className="qari-skeleton h-[22px] flex-1 rounded-[6px]" />
            <span className="qari-skeleton h-2.5 w-7 rounded-full" />
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className="qari-skeleton h-5 w-5 shrink-0 rounded-full" />
            <span className="qari-skeleton h-2.5 w-28 rounded-full" />
          </div>
        </div>
      ))}
    </RecitationCards>
  )
}
