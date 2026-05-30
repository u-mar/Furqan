'use client'

import { useRef } from 'react'
import { cn } from '@/lib/cn'

interface PinFieldProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  id?: string
}

export default function PinField({ value, onChange, disabled, id = 'account-pin' }: PinFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const digits = [0, 1, 2, 3]

  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-xs font-medium text-[var(--home-muted)]">
        PIN <span className="font-normal">(4 digits)</span>
      </label>
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.focus()}
        className="flex w-full justify-center gap-2.5 disabled:opacity-50"
        aria-label="Enter 4-digit PIN"
      >
        {digits.map((i) => {
          const filled = value.length > i
          return (
            <span
              key={i}
              className={cn(
                'flex h-[52px] w-11 items-center justify-center rounded-xl border text-lg transition-colors',
                filled
                  ? 'border-[var(--home-sage-deep)] bg-[var(--home-sage-soft)] text-[var(--home-heading)]'
                  : 'border-[var(--home-card-border)] bg-[var(--home-card-bg)] text-transparent'
              )}
              aria-hidden
            >
              {filled ? '•' : ''}
            </span>
          )
        })}
      </button>
      <input
        ref={inputRef}
        id={id}
        type="password"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={4}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
        className="sr-only"
      />
    </div>
  )
}
