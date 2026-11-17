'use client'

import { useEffect, useState } from 'react'
import { BadgeCheck, ListMusic, X } from 'lucide-react'
import { applyForVerification, type VerificationState } from '@/lib/qari'
import type { AppUser } from '@/lib/auth'
import { useT } from '@/lib/i18n'
import { useCloseOnBack } from '@/lib/native-back'

const MAX_NOTE = 500

/**
 * Applying to be a verified reciter, from your own profile. What the badge leads to is said
 * first: a playlist of whole surahs, or the full Quran, for people to listen to in Listen like the
 * well-known reciters. The admin reads the application and the recitations, then decides.
 */
export default function VerificationSheet({
  open,
  viewer,
  state,
  onClose,
  onApplied,
  onNotice,
}: {
  open: boolean
  viewer: AppUser
  state: VerificationState
  onClose: () => void
  onApplied: (state: VerificationState) => void
  onNotice: (message: string) => void
}) {
  const t = useT()
  useCloseOnBack(open, onClose)
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!open) setSending(false)
  }, [open])

  if (!open) return null

  const send = async () => {
    if (!note.trim() || sending) return
    setSending(true)
    try {
      onApplied(await applyForVerification(viewer, note))
    } catch (err) {
      onNotice(err instanceof Error ? err.message : t('Could not send that. Try again.'))
    } finally {
      setSending(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/55 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="qari-verify-title"
      onClick={onClose}
    >
      <div
        className="relative max-h-[calc(100dvh-2.5rem)] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-[1.75rem] border border-[var(--home-card-border)] bg-[var(--home-card-bg)] px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5 shadow-[var(--home-card-shadow)] sm:rounded-[1.75rem]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t('Close')}
          className="ed-focus absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-[var(--home-muted)] transition-colors hover:bg-[var(--app-surface)]"
        >
          <X className="h-4 w-4" strokeWidth={2} />
        </button>

        <BadgeCheck className="h-9 w-9 text-[var(--home-card-bg)]" fill="var(--qari-verified, #1d9bf0)" strokeWidth={2} aria-hidden />
        <h2 id="qari-verify-title" className="home-serif mt-3 pr-10 text-xl font-semibold text-[var(--home-heading)]">
          {state === 'verified' ? t('You are a verified reciter') : t('Become a verified reciter')}
        </h2>

        {/* What it leads to: the playlist, the reason to apply. */}
        <div className="mt-3 flex gap-3 rounded-2xl bg-[var(--app-surface)] px-3.5 py-3">
          <ListMusic className="mt-0.5 h-5 w-5 shrink-0 text-[var(--home-muted)]" strokeWidth={1.9} aria-hidden />
          <p className="text-[13.5px] leading-relaxed text-[var(--home-heading)]">
            {t(
              'Verified reciters get a badge and a Playlist: whole surahs, or the full Quran, in your voice, for people to listen to in Listen like the well-known reciters. Playlists are coming soon.'
            )}
          </p>
        </div>

        {state === 'verified' ? null : state === 'requested' ? (
          <p className="mt-4 text-[14px] leading-relaxed text-[var(--home-muted)]">
            {t('Your application has been sent. We will listen to your recitations and let you know.')}
          </p>
        ) : (
          <>
            <label htmlFor="qari-verify-note" className="mt-5 block text-[13px] font-medium text-[var(--home-heading)]">
              {t('About your recitation')}
            </label>
            <p className="mt-0.5 text-[12.5px] leading-snug text-[var(--home-muted)]">
              {t('Your riwayah, your teacher or ijazah, and which surahs you would like to record.')}
            </p>
            <textarea
              id="qari-verify-note"
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, MAX_NOTE))}
              rows={4}
              className="mt-2 w-full resize-none rounded-xl border border-[var(--home-card-border)] bg-[var(--app-surface)] px-3 py-2.5 text-[14px] leading-relaxed text-[var(--app-text)] focus:outline-none focus:ring-2 focus:ring-[var(--home-sage-deep)]/30"
            />
            <button
              type="button"
              onClick={() => void send()}
              disabled={!note.trim() || sending}
              className="qari-press ed-focus ed-ink mt-4 flex h-11 w-full items-center justify-center rounded-xl text-[14.5px] font-semibold disabled:opacity-50"
            >
              {sending ? t('Sending…') : t('Apply')}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
