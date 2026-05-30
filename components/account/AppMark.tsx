import { APP_ICON_LETTER } from '@/lib/app-brand'
import { cn } from '@/lib/cn'

export default function AppMark({ className, size = 'md' }: { className?: string; size?: 'sm' | 'md' }) {
  const box = size === 'sm' ? 'h-11 w-11 rounded-xl' : 'h-14 w-14 rounded-2xl'
  const letter = size === 'sm' ? 'text-xl' : 'text-[1.65rem]'

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center bg-black text-[#f5ecd8] shadow-[var(--home-card-shadow)]',
        box,
        className
      )}
      aria-hidden
    >
      <span className={cn('leading-none', letter)} style={{ fontFamily: 'Georgia, serif' }}>
        {APP_ICON_LETTER}
      </span>
    </div>
  )
}
