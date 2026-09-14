'use client'

import Link from 'next/link'
import LikeButton from '@/components/qari/LikeButton'
import PlayButton from '@/components/qari/PlayButton'
import QariAvatar from '@/components/qari/QariAvatar'
import { useQariPlayer } from '@/hooks/useQariPlayer'
import { tapFeedback } from '@/lib/haptics'
import { formatDuration, type Recitation } from '@/lib/qari'
import { togglePlayback } from '@/lib/qari-player'

/** A small card in the sideways "Most loved" row. */
export default function LovedCard({
  recitation,
  queue,
  viewerId,
  index,
  onNotice,
}: {
  recitation: Recitation
  queue: Recitation[]
  viewerId: string | null
  index: number
  onNotice?: (message: string) => void
}) {
  const player = useQariPlayer()
  const status = player.current?.id === recitation.id ? player.status : 'idle'

  return (
    <div
      className="qari-enter ed-card flex w-[164px] shrink-0 snap-start flex-col gap-2.5 rounded-2xl p-3"
      style={{ animationDelay: `${index * 45}ms` }}
    >
      <div className="flex items-center justify-between">
        <Link
          href={`/qari/${encodeURIComponent(recitation.userUsername)}`}
          aria-label={`${recitation.userName}’s profile`}
          className="qari-press ed-focus rounded-full"
        >
          <QariAvatar username={recitation.userUsername} name={recitation.userName} size={40} />
        </Link>
        <LikeButton recitation={recitation} viewerId={viewerId} onNotice={onNotice} compact />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-[var(--home-heading)]">{recitation.title}</p>
        <p className="mt-0.5 truncate text-[12.5px] text-[var(--home-muted)]">{recitation.userName}</p>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs tabular-nums text-[var(--home-muted)]">
          {formatDuration(recitation.durationSec)}
        </span>
        <PlayButton
          status={status}
          size={34}
          label={recitation.title}
          onClick={() => {
            tapFeedback()
            togglePlayback(recitation, { queue, viewerId })
          }}
        />
      </div>
    </div>
  )
}
