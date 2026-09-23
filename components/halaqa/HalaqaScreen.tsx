'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Check, ChevronLeft, CloudOff, Loader2, type LucideIcon } from 'lucide-react'
import { BOTTOM_NAV_HEIGHT_REM } from '@/lib/bottom-nav'
import { cn } from '@/lib/cn'
import { useT } from '@/lib/i18n'

/** The page around every halaqa screen: the same width and spacing as Settings. */
export function HalaqaScreen({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-[100dvh] bg-[var(--app-bg)] text-[var(--app-text)]">
      <div
        className="mx-auto w-full max-w-lg px-4 pt-[max(1rem,env(safe-area-inset-top))]"
        style={{ paddingBottom: `calc(${BOTTOM_NAV_HEIGHT_REM}rem + env(safe-area-inset-bottom) + 1.25rem)` }}
      >
        {children}
      </div>
    </main>
  )
}

export function HalaqaHeader({
  title,
  sub,
  backHref = '/halaqa',
  right,
}: {
  title: string
  sub?: string
  backHref?: string
  right?: ReactNode
}) {
  const t = useT()
  return (
    <header className="flex items-center gap-3">
      <Link href={backHref} className="home-round ed-focus" aria-label={t('Back')}>
        <ChevronLeft className="h-5 w-5" strokeWidth={1.9} />
      </Link>
      <div className="min-w-0 flex-1">
        <h1 className="home-serif truncate text-[1.625rem] font-semibold leading-tight tracking-[-0.02em] text-[var(--home-heading)]">
          {title}
        </h1>
        {sub ? <p className="truncate text-[0.8125rem] text-[var(--home-muted)]">{sub}</p> : null}
      </div>
      {right}
    </header>
  )
}

export function SectionLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mx-1 mb-2 mt-[22px] flex items-center justify-between gap-3">
      <h2 className="home-label">{children}</h2>
      {right}
    </div>
  )
}

export function Skeleton({ className }: { className: string }) {
  return <div className={`qari-skeleton ${className}`} aria-hidden />
}

/** Blocks that arrive together rise in one after another; `order` sets the beat. */
export function Rise({ order = 0, className, children }: { order?: number; className?: string; children: ReactNode }) {
  return (
    <div className={cn('fx-rise', className)} style={{ ['--i' as string]: order }}>
      {children}
    </div>
  )
}

export function ErrorCard({ message, onRetry }: { message: string; onRetry?: () => void | Promise<unknown> }) {
  const t = useT()
  const [retrying, setRetrying] = useState(false)
  const retry = async () => {
    if (!onRetry || retrying) return
    setRetrying(true)
    try {
      await onRetry()
    } finally {
      setRetrying(false)
    }
  }
  return (
    <div className="home-card fx-rise mt-[18px] flex flex-col items-center rounded-2xl px-4 py-6 text-center" role="alert">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--home-heading)_6%,transparent)] text-[var(--home-heading)]">
        <CloudOff className="h-5 w-5" strokeWidth={1.9} />
      </span>
      <p className="mt-3 text-sm text-[var(--home-heading)]">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={() => void retry()}
          disabled={retrying}
          className="ed-focus fx-press mt-3 flex h-10 items-center gap-2 rounded-full px-5 text-sm font-semibold text-[var(--home-sage-deep)] hover:bg-[var(--home-track)]"
        >
          {retrying ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.2} /> : null}
          {retrying ? t('Trying again') : t('Try again')}
        </button>
      ) : null}
    </div>
  )
}

type ActionKind = 'ink' | 'outline' | 'danger'

/**
 * The full-width buttons at the bottom of halaqa screens. While `busy` the
 * icon becomes a spinner and the button holds still, so a second tap is not
 * needed to know the first one landed.
 */
export function ActionButton({
  kind = 'ink',
  busy = false,
  icon: Icon,
  className,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { kind?: ActionKind; busy?: boolean; icon?: LucideIcon }) {
  return (
    <button
      type="button"
      {...props}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={cn(
        'ed-focus fx-press flex h-12 w-full items-center justify-center gap-2 rounded-full text-[0.90625rem] font-semibold transition-[opacity,background-color]',
        kind === 'ink' && 'ed-ink',
        kind === 'outline' && 'border border-[var(--home-rule-strong)] text-[var(--home-heading)] hover:bg-[var(--home-track)]',
        kind === 'danger' && 'bg-rose-600 text-white',
        busy ? 'cursor-progress' : 'disabled:opacity-60',
        className
      )}
    >
      {busy ? (
        <Loader2 className="h-[17px] w-[17px] animate-spin" strokeWidth={2.2} />
      ) : Icon ? (
        <Icon className="h-[17px] w-[17px]" strokeWidth={2.1} />
      ) : null}
      {children}
    </button>
  )
}

/** True for a moment after `flash()` — for "Copied" and other brief confirmations. */
export function useFlash(ms = 1800): [boolean, () => void] {
  const [on, setOn] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const flash = useCallback(() => {
    setOn(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setOn(false), ms)
  }, [ms])
  return [on, flash]
}

/** "Copy" that turns into a drawn tick and "Copied" for a moment. */
export function CopyLabel({ copied }: { copied: boolean }) {
  const t = useT()
  const used = useRef(false)
  if (copied) used.current = true
  return copied ? (
    <span key="copied" className="qari-swap flex shrink-0 items-center gap-1 text-sm font-semibold text-[var(--home-sage-deep)]">
      <Check className="fx-draw h-4 w-4" strokeWidth={2.8} />
      {t('Copied')}</span>
  ) : (
    <span key="copy" className={cn('shrink-0 text-sm font-semibold text-[var(--home-sage-deep)]', used.current && 'qari-swap')}>
      {t('Copy')}</span>
  )
}

/** Copies text, falling back to the old way where the clipboard API is not allowed (plain http). */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.cssText = 'position:fixed;opacity:0'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    area.remove()
    return ok
  }
}
