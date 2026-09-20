'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useT } from '@/lib/i18n'

interface SettingsSheetProps {
  open: boolean
  title: string
  description?: string
  onClose: () => void
  children: ReactNode
}

/**
 * The detail behind a settings row. The list stays short and scannable; the
 * choices, downloads and forms open here, over it.
 */
export default function SettingsSheet({ open, title, description, onClose, children }: SettingsSheetProps) {
  const t = useT()
  // Held in a ref so an inline onClose does not re-run the effect every render.
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  })

  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="qari-sheet fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={() => closeRef.current()}
    >
      <div
        className="qari-sheet__panel relative flex max-h-[90dvh] w-full max-w-md flex-col rounded-t-[1.75rem] bg-[var(--home-card-bg)] shadow-[var(--home-lift)] sm:rounded-[1.75rem]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 px-5 pt-3">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--home-rule-strong)] sm:hidden" aria-hidden />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="home-serif text-[1.3rem] font-semibold leading-tight text-[var(--home-heading)]">
                {title}
              </h2>
              {description ? (
                <p className="mt-1 text-[0.82rem] leading-relaxed text-[var(--home-muted)]">{description}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => closeRef.current()}
              aria-label={t('Close')}
              className="ed-focus -mr-1.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--home-muted)] transition-colors hover:bg-[var(--home-track)] hover:text-[var(--home-heading)]"
            >
              <X className="h-[18px] w-[18px]" strokeWidth={2} />
            </button>
          </div>
        </div>
        <div className="min-h-0 overflow-y-auto overscroll-contain px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
          {children}
        </div>
      </div>
    </div>,
    document.body
  )
}
