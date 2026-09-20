'use client'

import Link from 'next/link'
import { ChevronLeft, Search, X, type LucideIcon } from 'lucide-react'
import QariMiniPlayer from '@/components/qari/QariMiniPlayer'
import QariTabBar from '@/components/qari/QariTabBar'
import { errorFeedback, successFeedback, tapFeedback } from '@/lib/haptics'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/cn'
import { useT } from '@/lib/i18n'

/** Re-exported so the Qari screens keep one import for their shared chrome. */
export { useViewer } from '@/hooks/useViewer'

/** Round back button, a serif title and whatever sits on the right. */
export function QariHeader({
  title,
  sub,
  backHref = '/qari',
  action,
  back,
}: {
  title?: string
  sub?: string
  backHref?: string
  action?: React.ReactNode
  /** Replaces the back link, e.g. a close button. */
  back?: React.ReactNode
}) {
  const t = useT()
  return (
    <header className="flex items-center gap-3">
      {back ?? (
        <Link href={backHref} className="home-round ed-focus" aria-label={t('Back')}>
          <ChevronLeft className="h-5 w-5" strokeWidth={1.9} />
        </Link>
      )}
      <div className="min-w-0 flex-1">
        {title ? (
          <h1 className="home-serif truncate text-[1.625rem] font-semibold leading-tight tracking-[-0.02em] text-[var(--home-heading)]">
            {title}
          </h1>
        ) : null}
        {sub ? <p className="truncate text-[13px] text-[var(--home-muted)]">{sub}</p> : null}
      </div>
      {action}
    </header>
  )
}

/** The small tracked label above a card, with an optional action on the right. */
export function QariLabel({
  children,
  action,
  className,
}: {
  children: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('mx-1 mb-2 mt-[22px] flex min-h-5 items-center justify-between gap-3', className)}>
      <h2 className="home-label tabular-nums">{children}</h2>
      {action}
    </div>
  )
}

/** A search field in a white card, with a clear button once there is text. */
export function QariSearch({
  value,
  onChange,
  placeholder,
  label,
  className,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  label: string
  className?: string
}) {
  const t = useT()
  return (
    <label
      className={cn(
        'home-card flex h-12 items-center gap-2.5 rounded-[14px] px-3.5 focus-within:ring-2 focus-within:ring-[var(--home-sage)]',
        className
      )}
    >
      <Search className="h-[17px] w-[17px] shrink-0 text-[var(--home-muted)]" strokeWidth={2} aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        enterKeyHint="search"
        className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-[var(--home-heading)] outline-none placeholder:text-[var(--home-muted)] [&::-webkit-search-cancel-button]:hidden"
      />
      {value ? (
        <button
          type="button"
          onClick={() => {
            tapFeedback()
            onChange('')
          }}
          aria-label={t('Clear search')}
          className="ed-focus -mr-1.5 flex h-8 w-8 items-center justify-center rounded-full text-[var(--home-muted)] hover:text-[var(--home-heading)]"
        >
          <X className="h-4 w-4" strokeWidth={2.2} />
        </button>
      ) : null}
    </label>
  )
}

/** The app's segmented control: a track with the chosen option in ink. */
export function QariSegmented<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
  itemClassName = 'h-9',
}: {
  options: { id: T; label: string; Icon?: LucideIcon }[]
  value: T
  onChange: (value: T) => void
  label: string
  className?: string
  itemClassName?: string
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn('ed-seg', className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map(({ id, label: text, Icon }) => (
        <button
          key={id}
          type="button"
          aria-pressed={value === id}
          onClick={() => {
            if (value === id) return
            tapFeedback()
            onChange(id)
          }}
          className={cn(
            'ed-seg__item ed-focus flex items-center justify-center gap-1.5 truncate px-1 text-[0.8125rem] font-semibold',
            itemClassName
          )}
        >
          {Icon ? <Icon className="h-[15px] w-[15px] shrink-0" strokeWidth={2.2} /> : null}
          {text}
        </button>
      ))}
    </div>
  )
}

export function QariScreen({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <main className="min-h-[100dvh] bg-[var(--app-bg)] text-[var(--app-text)]">
      <div
        className={cn('mx-auto w-full max-w-lg px-4 pt-[max(1rem,env(safe-area-inset-top))]', className)}
        // Clear of the tab bar and the mini player above it.
        style={{ paddingBottom: 'calc(10rem + env(safe-area-inset-bottom))' }}
      >
        {children}
      </div>
      <QariMiniPlayer />
      <QariTabBar />
    </main>
  )
}

const SUCCESS = /copied|deleted|updated|removed|saved|thank you|published|following/i
const FAILURE = /^(could not|couldn|no connection|that recitation could not)/i

/** A Qari message as a toast, its tone read from the words. */
export function qariNotice(message: string) {
  if (FAILURE.test(message)) {
    errorFeedback()
    toast(message, 'error')
  } else if (SUCCESS.test(message)) {
    successFeedback()
    toast(message, 'success')
  } else {
    toast(message)
  }
}
