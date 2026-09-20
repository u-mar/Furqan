'use client'

import { useState } from 'react'
import { Heart } from 'lucide-react'
import { cn } from '@/lib/cn'
import { errorFeedback, tapFeedback } from '@/lib/haptics'
import { toastError } from '@/lib/toast'
import { useReciterFavorites } from '@/hooks/useReciterFavorites'
import type { Reciter } from '@/lib/reciters'
import { tr, useT } from '@/lib/i18n'

const ROSE = '#f43f5e'

/**
 * Favourite a reciter. The heart pops when it fills; with every place taken
 * it shakes and says why, rather than sitting there disabled.
 */
export default function HeartButton({
  reciter,
  size = 40,
  iconSize = 20,
  className,
}: {
  reciter: Reciter
  size?: number
  iconSize?: number
  className?: string
}) {
  const t = useT()
  const { isFavorite, toggle, atLimit, maxFavorites } = useReciterFavorites()
  const [motion, setMotion] = useState<{ kind: 'pop' | 'shake'; n: number } | null>(null)
  const on = isFavorite(reciter.id)

  const press = () => {
    if (!on && atLimit) {
      errorFeedback()
      setMotion((m) => ({ kind: 'shake', n: (m?.n ?? 0) + 1 }))
      toastError(tr('You can keep {maxFavorites} favourites. Remove one first.', { maxFavorites }))
      return
    }
    tapFeedback()
    if (toggle(reciter.id)) setMotion((m) => ({ kind: 'pop', n: (m?.n ?? 0) + 1 }))
  }

  return (
    <button
      type="button"
      onClick={press}
      aria-pressed={on}
      aria-label={on ? t('Remove {name} from favourites', { name: reciter.name }) : t('Add {name} to favourites', { name: reciter.name })}
      className={cn('ed-focus flex shrink-0 items-center justify-center rounded-full transition-colors', className)}
      style={{ width: size, height: size, color: on ? ROSE : 'var(--home-muted)' }}
    >
      <span
        key={motion?.n ?? 0}
        className={cn('flex', motion?.kind === 'pop' && 'qari-pop', motion?.kind === 'shake' && 'fx-shake')}
      >
        <Heart className={cn(on && 'fill-current')} style={{ width: iconSize, height: iconSize }} strokeWidth={2} />
      </span>
    </button>
  )
}
