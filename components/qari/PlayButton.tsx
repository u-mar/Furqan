'use client'

import { Pause, Play } from 'lucide-react'
import type { PlayerStatus } from '@/lib/qari-player'
import { cn } from '@/lib/cn'
import { useT } from '@/lib/i18n'

/**
 * Round play control, a filled teal circle. `tone="ivory"` is the version for
 * the deep-teal surfaces: an ivory circle with a deep-teal glyph.
 */
export default function PlayButton({
  status,
  onClick,
  label,
  size = 38,
  tone = 'teal',
  className,
}: {
  status: PlayerStatus
  onClick: () => void
  label: string
  size?: number
  tone?: 'teal' | 'ivory'
  className?: string
}) {
  const t = useT()
  const active = status === 'playing' || status === 'loading'
  const iconClass = size >= 48 ? 'h-5 w-5' : size >= 40 ? 'h-[18px] w-[18px]' : size >= 34 ? 'h-4 w-4' : 'h-3.5 w-3.5'

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={active ? t('Pause {label}', { label }) : t('Play {label}', { label })}
      className={cn(
        // The ::before keeps the tap area at 40px even when the circle is smaller.
        'qari-press ed-focus relative flex shrink-0 items-center justify-center rounded-full before:absolute before:-inset-[5px] before:content-[""]',
        tone === 'ivory'
          ? 'bg-[var(--qari-ivory,#f3ead6)] text-[var(--qari-deep,#12332e)]'
          : 'bg-[var(--home-sage)] text-[var(--qari-on-teal,#fff)]',
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
