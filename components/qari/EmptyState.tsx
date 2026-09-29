import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'

/**
 * A fine-line mihrab arch: the quiet picture on every empty state. The lucide
 * `Icon` is drawn small inside it, so each state still says what is missing.
 */
function Arch({ Icon }: { Icon: LucideIcon }) {
  return (
    <span className="relative mx-auto flex h-[74px] w-[60px] items-center justify-center text-[var(--home-sage-deep)]">
      <svg viewBox="0 0 60 74" fill="none" className="absolute inset-0 h-full w-full" aria-hidden>
        <path
          d="M4 72V32C4 16 16 4 30 2c14 2 26 14 26 30v40"
          stroke="currentColor"
          strokeOpacity="0.55"
          strokeWidth="1.25"
          strokeLinecap="round"
        />
        <path
          d="M10 72V33c0-12 8-22 20-25 12 3 20 13 20 25v39"
          stroke="var(--qari-gold)"
          strokeOpacity="0.55"
          strokeWidth="1"
          strokeLinecap="round"
        />
        <path d="M0 72h60" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1" strokeLinecap="round" />
      </svg>
      <Icon className="relative mt-3 h-6 w-6" strokeWidth={1.5} />
    </span>
  )
}

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
    'ed-ink ed-focus qari-press mt-5 inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm font-medium'

  return (
    <div className="qari-enter home-card rounded-[18px] px-6 py-8 text-center">
      <Arch Icon={Icon} />
      <p className="home-serif mt-4 text-[1.1875rem] font-medium tracking-[-0.01em] text-[var(--home-heading)]">
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
