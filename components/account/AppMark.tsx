import LogoMark from '@/components/brand/LogoMark'
import { cn } from '@/lib/cn'

/** The app icon, small: نبأ in square Kufic on its near-black square. */
export default function AppMark({ className, size = 'md' }: { className?: string; size?: 'sm' | 'md' }) {
  const box = size === 'sm' ? 'h-11 w-11 rounded-[0.625rem]' : 'h-14 w-14 rounded-[0.8125rem]'

  return (
    <div
      className={cn(
        'flex shrink-0 overflow-hidden bg-[#0b1512] shadow-[var(--home-card-shadow)]',
        box,
        className
      )}
      aria-hidden
    >
      <LogoMark className="h-full w-full" />
    </div>
  )
}
