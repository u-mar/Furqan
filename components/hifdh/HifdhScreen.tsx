'use client'

import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { BOTTOM_NAV_HEIGHT_REM } from '@/lib/bottom-nav'
import { cn } from '@/lib/cn'
import { useT } from '@/lib/i18n'

/** The page around every Hifdh Test screen: same width/spacing as Halaqa and Qari. */
export function HifdhScreen({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <main className="min-h-[100dvh] bg-[var(--app-bg)] text-[var(--app-text)]">
      <div
        className={cn('mx-auto w-full max-w-lg px-4 pt-[max(1rem,env(safe-area-inset-top))]', className)}
        style={{ paddingBottom: `calc(${BOTTOM_NAV_HEIGHT_REM}rem + env(safe-area-inset-bottom) + 1.25rem)` }}
      >
        {children}
      </div>
    </main>
  )
}

export function HifdhHeader({
  title,
  sub,
  backHref = '/hifdh',
  right,
}: {
  title: string
  sub?: string
  backHref?: string
  right?: React.ReactNode
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

/** A big picture-first choice card, like the two Hifdh modes on the landing
 *  page — the same noto icon-image style Prayer and Qibla use on Home,
 *  not a photo or a plain lucide icon standing in for one. */
export function HifdhModeCard({
  href,
  image,
  title,
  description,
}: {
  href: string
  /** An icon image from /public/icons/noto — the same set Prayer/Qibla use. */
  image: string
  title: string
  description: string
}) {
  return (
    <Link
      href={href}
      className="home-card home-press ed-focus flex items-center gap-3.5 rounded-2xl px-4 py-4"
    >
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--home-sage-soft)]">
        <img src={image} alt="" className="h-9 w-9" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="home-serif block text-[1.0625rem] font-semibold leading-tight text-[var(--home-heading)]">
          {title}
        </span>
        <span className="mt-1 block text-[0.8125rem] leading-snug text-[var(--home-muted)]">{description}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-[var(--home-muted)]" strokeWidth={2.2} />
    </Link>
  )
}
