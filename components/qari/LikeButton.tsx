'use client'

import { useCallback, useEffect, useState } from 'react'
import { Heart } from 'lucide-react'
import { tapFeedback } from '@/lib/haptics'
import { toggleLike, type Recitation } from '@/lib/qari'
import { cn } from '@/lib/cn'
import { tr, useT } from '@/lib/i18n'
import { askToSignIn } from '@/lib/account-prompt'

/** The heart: fills at once, pops, and quietly corrects itself if the server disagrees. */
export default function LikeButton({
  recitation,
  viewerId,
  onNotice,
  compact = false,
}: {
  recitation: Recitation
  viewerId: string | null
  onNotice?: (message: string) => void
  compact?: boolean
}) {
  const t = useT()
  const [liked, setLiked] = useState(recitation.liked)
  const [count, setCount] = useState(recitation.likeCount)
  const [popKey, setPopKey] = useState(0)

  // The feed can load before the viewer is known; follow the server's answer.
  useEffect(() => {
    setLiked(recitation.liked)
    setCount(recitation.likeCount)
  }, [recitation.liked, recitation.likeCount])

  const handle = useCallback(async () => {
    if (!viewerId) {
      askToSignIn({ reason: tr('Create a free account to save the recitations you love.') })
      return
    }
    tapFeedback()
    const next = !liked
    setLiked(next)
    setCount((n) => Math.max(0, n + (next ? 1 : -1)))
    if (next) setPopKey((k) => k + 1)
    try {
      const result = await toggleLike(recitation.id, viewerId, liked)
      setLiked(result.liked)
      setCount(result.likeCount)
    } catch {
      setLiked(liked)
      setCount(recitation.likeCount)
      onNotice?.(tr('Could not save that. Check your connection.'))
    }
  }, [liked, onNotice, recitation.id, recitation.likeCount, viewerId])

  return (
    <button
      type="button"
      onClick={() => void handle()}
      aria-pressed={liked}
      aria-label={liked ? t('Remove from favourites') : t('Add to favourites')}
      className={cn(
        'ed-focus flex shrink-0 items-center gap-1 rounded-full font-semibold transition-colors',
        compact ? 'h-8 px-1 text-xs' : 'h-11 min-w-11 justify-center px-1.5 text-[12.5px]',
        liked ? 'text-rose-500' : 'text-[var(--home-muted)] hover:text-[var(--home-heading)]'
      )}
    >
      <Heart
        key={popKey}
        className={cn(compact ? 'h-[17px] w-[17px]' : 'h-5 w-5', liked && 'fill-current', popKey > 0 && 'qari-pop')}
        strokeWidth={1.9}
      />
      {count > 0 ? <span className="tabular-nums">{count}</span> : null}
    </button>
  )
}
