'use client'

import { Clapperboard, Headphones } from 'lucide-react'
import { cn } from '@/lib/cn'
import { tapFeedback } from '@/lib/haptics'
import { useQariView, type QariView } from '@/lib/qari-view'
import { useT } from '@/lib/i18n'

/**
 * Audio or video: the same choice as the switch on Qari's front page, so a
 * profile or a search opens the way the person was already watching, and a
 * change here carries back there.
 */
export default function QariViewToggle({ className }: { className?: string }) {
  const t = useT()
  const [view, setView] = useQariView()
  const options: { id: QariView; label: string; Icon: typeof Headphones }[] = [
    { id: 'list', label: t('Audio'), Icon: Headphones },
    { id: 'swipe', label: t('Video'), Icon: Clapperboard },
  ]
  return (
    <div
      role="radiogroup"
      aria-label={t('Show as')}
      className={cn('flex h-[34px] items-center rounded-full bg-[var(--home-track)] p-[3px]', className)}
    >
      {options.map(({ id, label, Icon }) => {
        const on = view === id
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => {
              if (on) return
              tapFeedback()
              setView(id)
            }}
            className={cn(
              'ed-focus flex h-full items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold transition-colors',
              on ? 'bg-[var(--home-sage)] text-[var(--qari-on-teal)] shadow-sm' : 'text-[var(--home-muted)]'
            )}
          >
            <Icon className="h-[14px] w-[14px]" strokeWidth={2.1} />
            {label}
          </button>
        )
      })}
    </div>
  )
}
