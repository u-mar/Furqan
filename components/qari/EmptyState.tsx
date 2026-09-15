import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'

/** A quiet card that says why a list is empty and, where it can, what to do next. */
export default function EmptyState({
  Icon,
  title,
  body,
  action,
}: {
  Icon: LucideIcon
  title: string
  body: string
  action?: { label: string; href?: string; onClick?: () => void; Icon?: LucideIcon }
}) {
  const ActionIcon = action?.Icon
  const actionClass =
    'ed-ink ed-focus qari-press mt-5 inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold'

  return (
    <div className="qari-enter home-card rounded-[18px] px-6 py-8 text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--home-sage-soft)] text-[var(--home-sage-deep)] dark:text-[var(--home-sage)]">
        <Icon className="h-6 w-6" strokeWidth={1.9} />
      </span>
      <p className="home-serif mt-4 text-[1.1875rem] font-semibold tracking-[-0.01em] text-[var(--home-heading)]">
        {title}
      </p>
      <p className="mx-auto mt-1.5 max-w-[30ch] text-sm leading-relaxed text-[var(--home-muted)]">{body}</p>
      {action ? (
        action.href ? (
          <Link href={action.href} className={actionClass}>
            {ActionIcon ? <ActionIcon className="h-4 w-4" strokeWidth={2} /> : null}
            {action.label}
          </Link>
        ) : (
          <button type="button" onClick={action.onClick} className={actionClass}>
            {ActionIcon ? <ActionIcon className="h-4 w-4" strokeWidth={2} /> : null}
            {action.label}
          </button>
        )
      ) : null}
    </div>
  )
}
