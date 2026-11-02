'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
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
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mushaf-dock-select"
        aria-label={`${t('Choose reciter')}: ${current.name}`}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="mushaf-dock-select__caption">{t('Reciter')}</span>
        <span className="mushaf-dock-select__value">
          <span className="truncate">{current.name}</span>
          <ChevronDown className="mushaf-dock-select__chevron h-3.5 w-3.5" strokeWidth={2.4} />
        </span>
      </button>
      {open && (
        <ul
          className="mushaf-dock-menu absolute bottom-full start-2 z-50 mb-2 max-h-72 w-60 overflow-y-auto rounded-2xl py-1.5"
          role="listbox"
          aria-label={t('Choose reciter')}
        >
          {ayahCapableReciters().map((r) => (
            <li key={r.id}>
              <button
                type="button"
                role="option"
                aria-selected={r.id === reciterId}
                onClick={() => {
                  setAppSettings({ reciterId: r.id })
                  setOpen(false)
                }}
                className="mushaf-dock-menu__item"
              >
                <span className="truncate">{r.name}</span>
                {r.id === reciterId ? <Check className="h-4 w-4 shrink-0" strokeWidth={2.6} /> : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
