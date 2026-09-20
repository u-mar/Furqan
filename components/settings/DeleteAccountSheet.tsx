'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, TriangleAlert, X } from 'lucide-react'
import { clearSignedInUser, deleteLocalUser, loginLocalUser, type AppUser } from '@/lib/auth'
import { cn } from '@/lib/cn'
import { tr, useT } from '@/lib/i18n'

interface DeleteAccountSheetProps {
  open: boolean
  user: AppUser
  onClose: () => void
  onDeleted: () => void
}

/**
 * Permanent account deletion, which both app stores require an app to offer
 * in-app if it lets people create accounts.
 *
 * The PIN is asked for again so a phone left unlocked cannot be used to
 * erase someone's recitations, and the consequences are spelled out before
 * the button rather than after it.
 */
export default function DeleteAccountSheet({ open, user, onClose, onDeleted }: DeleteAccountSheetProps) {
  const t = useT()
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!open) return
    setPin('')
    setError('')
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  if (!open) return null

  const isLocal = user.id.startsWith('local_')

  async function confirmDelete() {
    if (pin.length !== 4) return
    setBusy(true)
    setError('')

    // A local account's PIN never leaves the device, so it is checked here.
    if (isLocal) {
      try {
        loginLocalUser(user.username, pin)
      } catch {
        setBusy(false)
        setPin('')
        setError(tr('That PIN is not right.'))
        return
      }
    }

    try {
      const res = await fetch('/api/auth/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user.username, userId: user.id, pin }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setPin('')
        setError(data.error || tr('Could not delete the account. Please try again.'))
        return
      }
      if (isLocal) deleteLocalUser(user.username)
      clearSignedInUser()
      onDeleted()
    } catch {
      setError(tr('Could not reach the server. Check your connection and try again.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/55 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-12 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-account-title"
      onClick={busy ? undefined : onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-3xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] px-5 pb-5 pt-6 shadow-[var(--home-card-shadow)]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          aria-label={t('Close')}
          className="ed-focus absolute right-3.5 top-3.5 flex h-9 w-9 items-center justify-center rounded-full text-[var(--home-muted)] transition-colors hover:bg-[var(--app-surface)]"
        >
          <X className="h-4 w-4" strokeWidth={2} />
        </button>

        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/12 text-rose-500">
          <TriangleAlert className="h-6 w-6" strokeWidth={1.9} />
        </span>

        <h2
          id="delete-account-title"
          className="home-serif mt-4 text-[1.45rem] font-semibold leading-tight text-[var(--home-heading)]"
        >
          {t('Delete your account?')}</h2>
        <p className="mt-2 text-[0.9rem] leading-relaxed text-[var(--home-muted)]">
          {t('This permanently removes @{username} and cannot be undone:', { username: user.username })}</p>
        <ul className="mt-3 space-y-1.5 text-[0.88rem] text-[var(--home-heading)]">
          <li>{t('• Every recitation you published, and its audio')}</li>
          <li>{t('• Your profile picture')}</li>
          <li>{t('• The recitations you saved to favourites')}</li>
        </ul>
        <p className="mt-3 text-[0.8rem] leading-relaxed text-[var(--home-muted)]">
          {t('Bookmarks and reading progress stored on this phone stay on this phone.')}</p>

        <label htmlFor="delete-pin" className="mt-5 block text-[0.8rem] font-semibold text-[var(--home-heading)]">
          {t('Enter your PIN to confirm')}</label>
        <button
          type="button"
          onClick={() => inputRef.current?.focus()}
          disabled={busy}
          className={cn('mt-2.5 flex w-full justify-center gap-2.5', error && 'auth-shake')}
          aria-label={t('Enter your 4-digit PIN')}
        >
          {[0, 1, 2, 3].map((i) => {
            const filled = pin.length > i
            return (
              <span
                key={i}
                className={cn(
                  'flex h-14 w-12 items-center justify-center rounded-xl border-2 transition-colors',
                  error
                    ? 'border-rose-400/70'
                    : filled
                      ? 'border-rose-500/70 bg-rose-500/8'
                      : 'border-[var(--home-rule-strong)]'
                )}
                aria-hidden
              >
                {filled ? <span className="h-3 w-3 rounded-full bg-[var(--home-heading)]" /> : null}
              </span>
            )
          })}
        </button>
        <input
          ref={inputRef}
          id="delete-pin"
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          maxLength={4}
          value={pin}
          disabled={busy}
          onChange={(e) => {
            setPin(e.target.value.replace(/\D/g, '').slice(0, 4))
            if (error) setError('')
          }}
          className="sr-only"
        />

        {error ? (
          <p className="mt-3 text-center text-[0.85rem] font-medium text-rose-500" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-5 grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="ed-focus h-12 rounded-2xl border border-[var(--home-rule-strong)] text-[0.92rem] font-semibold text-[var(--home-heading)] transition-colors hover:bg-[var(--home-track)] disabled:opacity-50"
          >
            {t('Keep account')}</button>
          <button
            type="button"
            onClick={() => void confirmDelete()}
            disabled={busy || pin.length !== 4}
            className="ed-focus flex h-12 items-center justify-center rounded-2xl bg-rose-600 text-[0.92rem] font-semibold text-white transition-opacity disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : t('Delete')}
          </button>
        </div>
      </div>
    </div>
  )
}
