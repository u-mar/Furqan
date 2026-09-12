'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import HomeScreen from '@/components/home/HomeScreen'
import QariTabBar from '@/components/qari/QariTabBar'

/** Re-exported so the Qari screens keep one import for their shared chrome. */
export { useViewer } from '@/hooks/useViewer'

export function QariHeader({
  eyebrow,
  title,
  backHref = '/',
  action,
}: {
  eyebrow: string
  title: string
  backHref?: string
  action?: React.ReactNode
}) {
  return (
    <header className="mb-5 flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <Link
          href={backHref}
          className="ed-focus flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--home-rule-strong)] text-[var(--home-heading)] transition-colors hover:bg-[var(--home-ink)] hover:text-[var(--home-ink-fg)] active:scale-95"
          aria-label="Back"
        >
          <ChevronLeft className="h-5 w-5" strokeWidth={1.75} />
        </Link>
        <div className="min-w-0">
          <p className="ed-label">{eyebrow}</p>
          <h1 className="home-serif mt-1 truncate text-[1.5rem] font-medium leading-tight tracking-[-0.025em] text-[var(--home-heading)] sm:text-[2rem]">
            {title}
          </h1>
        </div>
      </div>
      {action}
    </header>
  )
}

export function QariScreen({ children }: { children: React.ReactNode }) {
  // pb-28 keeps the last card clear of the fixed bar along the bottom.
  return (
    <HomeScreen className="mx-auto max-w-lg pb-28">
      {children}
      <QariTabBar />
    </HomeScreen>
  )
}

export function Notice({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[max(1.5rem,env(safe-area-inset-bottom))] z-[120] flex justify-center px-4">
      <p className="ed-ink max-w-sm rounded-full px-4 py-2.5 text-center text-xs font-semibold shadow-lg">
        {message}
      </p>
    </div>
  )
}

export function useNotice() {
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    if (!notice) return
    const id = window.setTimeout(() => setNotice(null), 3200)
    return () => window.clearTimeout(id)
  }, [notice])

  return { notice, setNotice }
}
