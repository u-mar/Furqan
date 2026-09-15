'use client'

import Link from 'next/link'
import { useEffect, useState, type ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'

/** The page around every halaqa screen: the same width and spacing as Settings. */
export function HalaqaScreen({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-[100dvh] bg-[var(--app-bg)] text-[var(--app-text)]">
      <div className="mx-auto w-full max-w-lg px-4 pb-[max(1.75rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
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
  return (
    <header className="flex items-center gap-3">
      <Link href={backHref} className="home-round ed-focus" aria-label="Back">
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

/** A short message along the bottom that fades on its own. */
export function useToast() {
  const [toast, setToast] = useState('')
  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(''), 2600)
    return () => window.clearTimeout(id)
  }, [toast])
  return { toast, showToast: setToast }
}

export function Toast({ message }: { message: string }) {
  if (!message) return null
  return (
    <div
      className="qari-enter pointer-events-none fixed inset-x-0 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-[60] flex justify-center px-4"
      role="status"
    >
      <p className="ed-ink max-w-sm rounded-full px-4 py-2.5 text-center text-sm font-semibold shadow-lg">{message}</p>
    </div>
  )
}

export function ErrorCard({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="home-card mt-[18px] rounded-2xl px-4 py-5 text-center">
      <p className="text-sm text-[var(--home-heading)]">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="ed-focus mt-3 h-10 rounded-full px-5 text-sm font-semibold text-[var(--home-sage-deep)] hover:bg-[var(--home-track)]"
        >
          Try again
        </button>
      ) : null}
    </div>
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
