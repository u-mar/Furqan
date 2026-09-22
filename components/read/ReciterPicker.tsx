'use client'

import { useEffect, useRef, useState } from 'react'
import { UserRound } from 'lucide-react'
import { cn } from '@/lib/cn'
import { setAppSettings } from '@/lib/app-settings'
import { ayahCapableReciters, RECITERS } from '@/lib/reciters'
import { useT } from '@/lib/i18n'

interface ReciterPickerProps {
  reciterId: string
  className?: string
}

export default function ReciterPicker({ reciterId, className }: ReciterPickerProps) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const current = RECITERS.find((r) => r.id === reciterId) ?? RECITERS[0]

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  return (
    <div ref={rootRef} className={cn('relative shrink-0', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mushaf-read-chrome-panel mushaf-read-chrome-btn flex h-8 w-8 items-center justify-center rounded-lg"
        aria-label={`${t('Choose reciter')}: ${current.name}`}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <UserRound className="h-3.5 w-3.5" />
      </button>
      {open && (
        <ul
          className="absolute bottom-full left-0 z-50 mb-2 max-h-52 w-56 overflow-y-auto rounded-xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] py-1 shadow-[var(--home-card-shadow)]"
          role="listbox"
        >
          {ayahCapableReciters().map((r) => (
            <li key={r.id} role="option" aria-selected={r.id === reciterId}>
              <button
                type="button"
                onClick={() => {
                  setAppSettings({ reciterId: r.id })
                  setOpen(false)
                }}
                className={cn(
                  'w-full px-4 py-2.5 text-left text-sm text-[var(--app-text)] transition-colors hover:bg-teal-500/10',
                  r.id === reciterId &&
                    'bg-teal-500/15 font-semibold text-teal-800 dark:text-teal-400'
                )}
              >
                {r.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
