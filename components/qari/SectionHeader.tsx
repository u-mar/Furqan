import { cn } from '@/lib/cn'

/** A section title with an optional control on the right, spaced for the Qari lists. */
export default function SectionHeader({
  title,
  action,
  first = false,
}: {
  title: string
  action?: React.ReactNode
  /** The first section sits closer to the search row. */
  first?: boolean
}) {
  return (
    <div className={cn('flex items-center justify-between gap-3 pb-2', first ? 'pt-5' : 'pt-7')}>
      <h2 className="text-lg font-bold tracking-[-0.01em] text-[var(--home-heading)]">{title}</h2>
      {action}
    </div>
  )
}
