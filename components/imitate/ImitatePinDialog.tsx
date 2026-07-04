'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { unlockImitate } from '@/lib/imitate-access'
import Button from '@/components/ui/Button'

interface ImitatePinDialogProps {
  open: boolean
  onClose?: () => void
  onUnlocked?: () => void
  navigateOnUnlock?: boolean
}

export default function ImitatePinDialog({
  open,
  onClose,
  onUnlocked,
  navigateOnUnlock = false,
}: ImitatePinDialogProps) {
  const router = useRouter()
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setPin('')
      setError('')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  if (!open) return null

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (unlockImitate(pin)) {
      onUnlocked?.()
      if (navigateOnUnlock) router.push('/imitate')
      onClose?.()
      return
    }
    setError('Incorrect PIN.')
    setPin('')
    inputRef.current?.focus()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 px-4 pb-4 pt-10 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="imitate-pin-title"
      onClick={() => onClose?.()}
    >
      <div
        className={cn(
          'w-full max-w-md rounded-3xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] p-5 text-[var(--app-text)] shadow-2xl'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--home-sage)]">
              Preview access
            </p>
            <h2 id="imitate-pin-title" className="home-serif mt-1 text-xl font-semibold">
              Enter PIN
            </h2>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-[var(--app-muted)] hover:bg-[var(--app-surface)]"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
        <p className="mb-4 text-sm leading-relaxed text-[var(--app-muted)]">
          Imitate mode is in preview. Enter the access PIN to continue.
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            ref={inputRef}
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={8}
            value={pin}
            onChange={(e) => {
              setPin(e.target.value)
              setError('')
            }}
            placeholder="PIN"
            className="w-full rounded-xl border border-[var(--home-card-border)] bg-[var(--app-surface)] px-4 py-3 text-center text-lg tracking-[0.3em] text-[var(--app-text)] outline-none focus:ring-2 focus:ring-[var(--home-sage)]/40"
          />
          {error && <p className="text-center text-sm text-red-500">{error}</p>}
          <Button type="submit" size="lg" className="w-full">
            Unlock Imitate
          </Button>
        </form>
      </div>
    </div>
  )
}
