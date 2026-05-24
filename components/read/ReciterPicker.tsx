'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'
import { setAppSettings } from '@/lib/app-settings'
import { RECITERS } from '@/lib/reciters'

interface ReciterPickerProps {
  reciterId: string
  className?: string
}

export default function ReciterPicker({ reciterId, className }: ReciterPickerProps) {
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
    <div ref={rootRef} className={cn('relative min-w-0 flex-1', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex max-w-full items-center gap-1 text-sm font-medium text-teal-700 dark:text-teal-400"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="truncate text-[var(--app-text)]">{current.name}</span>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-[var(--app-muted)] transition-transform',
            open && 'rotate-180'
          )}
        />
      </button>
      {open && (
        <ul
          className="absolute bottom-full left-0 z-50 mb-2 max-h-52 w-64 overflow-y-auto rounded-xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] py-1 shadow-[var(--home-card-shadow)]"
          role="listbox"
        >
          {RECITERS.map((r) => (
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
