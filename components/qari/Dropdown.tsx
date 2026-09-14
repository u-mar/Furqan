'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { ArrowDownUp, Check, ChevronDown, type LucideIcon } from 'lucide-react'
import { tapFeedback } from '@/lib/haptics'
import { cn } from '@/lib/cn'

export interface DropdownOption<T extends string> {
  id: T
  label: string
  hint?: string
  Icon?: LucideIcon
}

/**
 * A pill that names the current choice and opens a short list under it.
 *
 * `sort` is the feed's sort control (with the up-down arrows); `field` is a
 * setting inside a card, like the sound or the sheikh on the record page.
 */
export default function Dropdown<T extends string>({
  value,
  options,
  onChange,
  label,
  variant = 'sort',
  align = 'right',
}: {
  value: T
  options: DropdownOption<T>[]
  onChange: (value: T) => void
  label: string
  variant?: 'sort' | 'field'
  align?: 'left' | 'right'
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const listId = useId()

  // Tapping anywhere else, or Escape, puts it away.
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

  // A long list opens scrolled to what is chosen.
  useEffect(() => {
    if (!open) return
    rootRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [open])

  const current = options.find((o) => o.id === value) ?? options[0]

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`${label}: ${current.label}`}
        className={cn('qari-dropdown qari-press ed-focus', variant === 'field' && 'qari-dropdown--in-card')}
      >
        {variant === 'sort' ? (
          <ArrowDownUp className="h-[15px] w-[15px] text-[var(--home-muted)]" strokeWidth={2} />
        ) : null}
        <span className="max-w-[9.5rem] truncate">{current.label}</span>
        <ChevronDown
          className="h-[15px] w-[15px] text-[var(--home-muted)] transition-transform duration-200"
          strokeWidth={2.2}
          style={{ transform: open ? 'rotate(180deg)' : 'none' }}
        />
      </button>

      {open ? (
        <div
          id={listId}
          role="listbox"
          aria-label={label}
          className={cn(
            'qari-dropdown__menu top-[calc(100%+0.4rem)]',
            align === 'right' ? 'right-0' : 'left-0 origin-top-left',
            variant === 'field' ? 'w-[15rem]' : 'w-[12rem]'
          )}
        >
          {options.map(({ id, label: optionLabel, hint, Icon }) => {
            const selected = id === value
            return (
              <button
                key={id}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  tapFeedback()
                  onChange(id)
                  setOpen(false)
                }}
                className="qari-dropdown__item ed-focus"
              >
                {Icon ? <Icon className="h-4 w-4 shrink-0 text-[var(--home-muted)]" strokeWidth={2} /> : null}
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{optionLabel}</span>
                  {hint ? (
                    <span className="block truncate text-[11.5px] font-normal text-[var(--home-muted)]">{hint}</span>
                  ) : null}
                </span>
                {selected ? (
                  <Check className="h-4 w-4 shrink-0 text-[var(--home-sage)]" strokeWidth={2.6} />
                ) : null}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
