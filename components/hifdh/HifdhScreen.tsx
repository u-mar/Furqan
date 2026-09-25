'use client'

import Link from 'next/link'
import { ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react'
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
 *  page — a real photo behind the title, not an icon standing in for one. */
export function HifdhModeCard({
  href,
  image,
  icon: Icon,
  title,
  description,
}: {
  href: string
  /** A photo from /public/share-bg — the same library ayah/recitation shares use. */
  image: string
  /** A small badge icon over the corner of the photo, for quick recognition at a glance. */
  icon: LucideIcon
  title: string
  description: string
}) {
  return (
    <Link
      href={href}
      className="home-press ed-focus group relative block overflow-hidden rounded-[20px]"
    >
      <div className="relative aspect-[16/10] w-full">
        <img
          src={image}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-active:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/5" />
        <span className="absolute right-3.5 top-3.5 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm">
          <Icon className="h-[18px] w-[18px]" strokeWidth={1.9} />
        </span>
        <span className="absolute inset-x-4 bottom-3.5 flex items-end justify-between gap-3">
          <span className="min-w-0">
            <span className="home-serif block text-[1.1875rem] font-semibold leading-tight text-white">{title}</span>
            <span className="mt-1 block text-[0.78125rem] leading-snug text-white/80">{description}</span>
          </span>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/90 text-black">
            <ChevronRight className="h-4 w-4" strokeWidth={2.4} />
          </span>
        </span>
      </div>
    </Link>
  )
}
