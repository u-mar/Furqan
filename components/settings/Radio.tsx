import { cn } from '@/lib/cn'

/** The round choice marker in Settings-style lists; the dot springs in when chosen. */
export default function Radio({ on }: { on: boolean }) {
  return (
    <span
      className={cn(
        'flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors duration-200',
        on ? 'border-[var(--home-sage)] bg-[var(--home-sage)]' : 'border-[var(--home-rule-strong)]'
      )}
      aria-hidden
    >
      <span
        className={cn(
          'h-2 w-2 rounded-full bg-[var(--home-ink-fg)] transition-transform duration-200 [transition-timing-function:cubic-bezier(0.3,1.5,0.5,1)] motion-reduce:transition-none',
          on ? 'scale-100' : 'scale-0'
        )}
      />
    </span>
  )
}
