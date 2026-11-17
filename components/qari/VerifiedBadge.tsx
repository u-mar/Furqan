import { cn } from '@/lib/cn'
import { useT } from '@/lib/i18n'

/** The rosette's outline (lucide's badge-check), filled in. */
const ROSETTE =
  'M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z'

/**
 * The verified reciter's mark beside a name: a solid blue rosette with a white check, the way
 * other apps show it, so it reads the same on the light and the dark themes.
 */
export default function VerifiedBadge({ className }: { className?: string }) {
  const t = useT()
  return (
    <svg
      viewBox="0 0 24 24"
      role="img"
      aria-label={t('Verified reciter')}
      className={cn('h-[1.05em] w-[1.05em] shrink-0', className)}
    >
      <path d={ROSETTE} fill="var(--qari-verified, #1d9bf0)" stroke="var(--qari-verified, #1d9bf0)" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="m8.75 12.1 2.25 2.25 4.25-4.6" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
