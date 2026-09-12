'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface FilterOption<T extends string> {
  id: T
  label: string
  Icon: LucideIcon
}

/**
 * A compact chooser that names the current filter and opens a short list.
 *
 * A segmented control spends a whole row showing you the option you did not
 * pick; this spends a pill and gives the row back to the feed.
 */
export default function FilterMenu<T extends string>({
  value,
  options,
  onChange,
  label = 'Filter',
}: {
  value: T
  options: FilterOption<T>[]
  onChange: (value: T) => void
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  // Tapping anywhere else, or Escape, should put it away.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const current = options.find((o) => o.id === value) ?? options[0]
  const CurrentIcon = current.Icon

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${current.label}`}
        className={cn(
          'ed-focus flex h-10 items-center gap-1.5 rounded-full border px-3.5 text-[0.82rem] font-semibold transition-colors',
          open
            ? 'border-transparent bg-[var(--home-ink)] text-[var(--home-ink-fg)]'
            : 'border-[var(--home-rule-strong)] text-[var(--home-heading)] hover:bg-[var(--home-track)]'
        )}
      >
        <CurrentIcon className="h-[15px] w-[15px]" strokeWidth={2} />
        {current.label}
        <ChevronDown
          className="h-[15px] w-[15px] transition-transform"
          strokeWidth={2}
          style={{ transform: open ? 'rotate(180deg)' : 'none' }}
        />
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label={label}
          className="qari-menu absolute left-0 top-[calc(100%+0.4rem)] z-40 min-w-[11rem] overflow-hidden rounded-2xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] p-1"
        >
          {options.map(({ id, label: optionLabel, Icon }) => {
            const selected = id === value
            return (
              <button
                key={id}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onChange(id)
                  setOpen(false)
                }}
                className={cn(
                  'ed-focus flex min-h-[42px] w-full items-center gap-2.5 rounded-xl px-3 text-left text-[0.85rem] font-medium transition-colors',
                  selected
                    ? 'bg-[var(--home-track)] text-[var(--home-heading)]'
                    : 'text-[var(--home-muted)] hover:bg-[var(--home-track)] hover:text-[var(--home-heading)]'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" strokeWidth={2} />
                <span className="flex-1">{optionLabel}</span>
                {selected ? (
                  <Check
                    className="h-4 w-4 shrink-0 text-[var(--home-sage-deep)]"
                    strokeWidth={2.4}
                  />
                ) : null}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
