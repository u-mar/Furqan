'use client'

import { useEffect } from 'react'
import type { MushafBoundary } from '@/lib/mushaf-boundaries'

interface MushafBoundaryToastProps {
  boundary: MushafBoundary | null
  onDismiss: () => void
}

export default function MushafBoundaryToast({ boundary, onDismiss }: MushafBoundaryToastProps) {
  useEffect(() => {
    if (!boundary) return
    const timer = window.setTimeout(onDismiss, 2000)
    return () => window.clearTimeout(timer)
  }, [boundary, onDismiss])

  if (!boundary) return null

  const title = boundary.kind === 'juz' ? `Juz ${boundary.juz}` : `Ḥizb ${boundary.hizb}`
  const subtitle = boundary.kind === 'hizb' ? `Juz ${boundary.juz}` : undefined

  return (
    <div
      className="mushaf-boundary-toast pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
      role="status"
      aria-live="polite"
      aria-label={title}
    >
      <div className="mushaf-boundary-toast-card px-10 py-8 text-center">
        <p className="mushaf-boundary-toast-title home-serif text-[clamp(2rem,9vw,3.25rem)] font-semibold leading-none tracking-tight">
          {title}
        </p>
        {subtitle && (
          <p className="mt-2 text-sm font-medium text-[var(--mushaf-read-meta)]">{subtitle}</p>
        )}
      </div>
    </div>
  )
}
