'use client'

import { Pause, Play } from 'lucide-react'
import type { PlayerStatus } from '@/lib/qari-player'
import { cn } from '@/lib/cn'
import { useT } from '@/lib/i18n'

/**
 * Round play control in ink; `accent` makes the idle state the accent, for a
 * call to play something.
 */
export default function PlayButton({
  status,
  onClick,
  label,
  size = 38,
  accent = false,
  className,
}: {
  status: PlayerStatus
  onClick: () => void
  label: string
  size?: number
  accent?: boolean
  className?: string
}) {
  const t = useT()
  const active = status === 'playing' || status === 'loading'
  const iconClass = size >= 48 ? 'h-5 w-5' : size >= 40 ? 'h-4 w-4' : 'h-[15px] w-[15px]'

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={active ? t('Pause {label}', { label }) : t('Play {label}', { label })}
      className={cn(
        'qari-press ed-focus flex shrink-0 items-center justify-center rounded-full',
        accent && !active ? 'bg-[var(--home-sage)] text-white' : 'ed-ink',
        className
      )}
      style={{ width: size, height: size }}
    >
      {status === 'loading' ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : active ? (
        <Pause key="pause" className={cn('qari-swap fill-current', iconClass)} strokeWidth={0} />
      ) : (
        <Play key="play" className={cn('qari-swap ml-0.5 fill-current', iconClass)} strokeWidth={0} />
      )}
    </button>
  )
}
