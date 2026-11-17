'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Search, X, type LucideIcon } from 'lucide-react'
import QariMiniPlayer from '@/components/qari/QariMiniPlayer'
import QariRecordFab from '@/components/qari/QariRecordFab'
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
  hideBack = false,
}: {
  title?: string
  sub?: string
  backHref?: string
  action?: React.ReactNode
  /** Replaces the back link, e.g. a close button. */
  back?: React.ReactNode
  /** No back button at all — for a screen the bottom bar already leads to. */
  hideBack?: boolean
}) {
  const t = useT()
  const router = useRouter()
  return (
    <header className="flex items-center gap-3">
      {hideBack
        ? null
        : (back ?? (
            // Back goes to the screen this was opened from (your profile, say), not always to the
            // Qari feed; the link is only for a page opened directly, with nothing behind it.
            <Link
              href={backHref}
              onClick={(e) => {
                if (typeof window === 'undefined' || window.history.length <= 1) return
                e.preventDefault()
                router.back()
              }}
              className="home-round ed-focus"
              aria-label={t('Back')}
            >
              <ChevronLeft className="h-5 w-5" strokeWidth={1.9} />
            </Link>
          ))}
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

/** A section heading — quiet, sentence case — with an optional action on the right. */
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
    <div className={cn('mx-0.5 mb-2 mt-6 flex min-h-5 items-center justify-between gap-3', className)}>
      <h2 className="text-[13px] font-medium tabular-nums text-[var(--home-heading)]">{children}</h2>
      {action}
    </div>
  )
}

/** A search field in a card, with a clear button once there is text. */
export function QariSearch({
  value,
  onChange,
  onSubmit,
  onFocus,
  placeholder,
  label,
  className,
  autoFocus = false,
}: {
  value: string
  onChange: (value: string) => void
  /** Searching for what is typed (the keyboard's search key, or the Search word at the end). */
  onSubmit?: () => void
  onFocus?: () => void
  placeholder: string
  label: string
  className?: string
  autoFocus?: boolean
}) {
  const t = useT()
  // As on TikTok: a flat grey field with the magnifier in it, and "Search" in words beside it.
  return (
    <form
      role="search"
      className={cn('flex items-center gap-3', className)}
      onSubmit={(e) => {
        e.preventDefault()
        if (!value.trim()) return
        ;(document.activeElement as HTMLElement | null)?.blur()
        onSubmit?.()
      }}
    >
      <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-lg bg-[color-mix(in_srgb,var(--home-heading)_8%,var(--app-bg))] px-3">
        <Search className="h-[18px] w-[18px] shrink-0 text-[var(--home-muted)]" strokeWidth={2.1} aria-hidden />
        <input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          placeholder={placeholder}
          aria-label={label}
          autoFocus={autoFocus}
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-[var(--home-heading)] caret-[var(--home-heading)] outline-none placeholder:text-[var(--home-muted)] [&::-webkit-search-cancel-button]:hidden"
        />
        {value ? (
          <button
            type="button"
            onClick={() => {
              tapFeedback()
              onChange('')
            }}
            aria-label={t('Clear search')}
            className="ed-focus -mr-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--home-heading)_28%,transparent)] text-[var(--app-bg)]"
          >
            <X className="h-3 w-3" strokeWidth={3} />
          </button>
        ) : null}
      </label>
      {onSubmit ? (
        <button
          type="submit"
          className="ed-focus shrink-0 text-[15px] font-semibold text-[var(--home-heading)] disabled:opacity-40"
          disabled={!value.trim()}
        >
          {t('Search')}
        </button>
      ) : null}
    </form>
  )
}

/** A row of pills for sorting or filtering a list; the chosen one is teal. */
export function QariChips<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: { id: T; label: string }[]
  value: T
  onChange: (value: T) => void
  label: string
  className?: string
}) {
  return (
    <div role="group" aria-label={label} className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {options.map(({ id, label: text }) => (
        <button
          key={id}
          type="button"
          aria-pressed={value === id}
          onClick={() => {
            if (value === id) return
            tapFeedback()
            onChange(id)
          }}
          className="qari-pill qari-press ed-focus"
        >
          {text}
        </button>
      ))}
    </div>
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

export function QariScreen({
  children,
  className,
  bare = false,
  recordFab = true,
}: {
  children: React.ReactNode
  className?: string
  /** No padded column: the content lays itself out (the full-screen swipe view). */
  bare?: boolean
  /** Off where something else on the screen starts a recording. */
  recordFab?: boolean
}) {
  return (
    <main className="qari-theme min-h-[100dvh] text-[var(--app-text)]">
      {bare ? (
        children
      ) : (
        <div
          className={cn('mx-auto w-full max-w-lg px-4 pt-[max(1rem,env(safe-area-inset-top))]', className)}
          // Clear of the main bottom bar, the record button and the mini player above it,
          // so the last card's share button never ends up underneath them.
          style={{ paddingBottom: 'calc(11rem + env(safe-area-inset-bottom))' }}
        >
          {children}
        </div>
      )}
      {/* The full-screen view is the player: a mini one flashing up mid-swipe would be a second one. */}
      {bare ? null : <QariMiniPlayer />}
      {recordFab ? <QariRecordFab /> : null}
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
