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
      <div className="mushaf-boundary-toast-card px-5 py-3.5 text-center">
        <p className="mushaf-boundary-toast-title home-serif text-[clamp(1.1rem,4.5vw,1.5rem)] font-semibold leading-tight tracking-tight">
          {title}
        </p>
        {subtitle && (
          <p className="mt-1 text-[11px] font-medium text-[var(--mushaf-read-meta)]">{subtitle}</p>
        )}
      </div>
    </div>
  )
}
