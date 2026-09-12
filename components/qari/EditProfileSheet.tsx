'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, Trash2, X } from 'lucide-react'
import QariAvatar, { removeAvatar, uploadAvatar } from '@/components/qari/QariAvatar'
import { renameQari } from '@/lib/qari'
import { renameLocalUser, setSignedInUser, type AppUser } from '@/lib/auth'

interface EditProfileSheetProps {
  open: boolean
  viewer: AppUser
  /** Bumped whenever the picture changes, to defeat the image cache. */
  avatarVersion?: number
  hasAvatar: boolean
  onClose: () => void
  onSaved: (changes: { name?: string; avatarChanged?: boolean }) => void
  onNotice: (message: string) => void
}

/**
 * Everything about your own profile that can be changed, in one sheet — the
 * picture and the display name. The handle is deliberately not editable: it
 * addresses your profile, your avatar and every link you have shared.
 */
export default function EditProfileSheet({
  open,
  viewer,
  avatarVersion,
  hasAvatar,
  onClose,
  onSaved,
  onNotice,
}: EditProfileSheetProps) {
  const [name, setName] = useState(viewer.name)
  const [saving, setSaving] = useState(false)
  const [busyPhoto, setBusyPhoto] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)

  // Reopening should show what is stored now, not the last thing typed.
  useEffect(() => {
    if (open) setName(viewer.name)
  }, [open, viewer.name])

  const handlePhoto = useCallback(
    async (file: File) => {
      setBusyPhoto(true)
      try {
        await uploadAvatar(file, viewer)
        onSaved({ avatarChanged: true })
        onNotice('Profile picture updated.')
      } catch (err) {
        onNotice(err instanceof Error ? err.message : 'Could not save that picture.')
      } finally {
        setBusyPhoto(false)
      }
    },
    [onNotice, onSaved, viewer]
  )

  const handleRemovePhoto = useCallback(async () => {
    setBusyPhoto(true)
    try {
      await removeAvatar(viewer)
      onSaved({ avatarChanged: true })
      onNotice('Picture removed.')
    } catch {
      onNotice('Could not remove that picture.')
    } finally {
      setBusyPhoto(false)
    }
  }, [onNotice, onSaved, viewer])

  const handleSave = useCallback(async () => {
    const next = name.trim()
    if (!next) {
      onNotice('Your name cannot be empty.')
      return
    }
    if (next === viewer.name) {
      onClose()
      return
    }

    setSaving(true)
    try {
      const saved = await renameQari(viewer, next)
      // Local-only accounts keep their own record of the name as well.
      if (viewer.id.startsWith('local_')) renameLocalUser(viewer.username, saved)
      setSignedInUser({ ...viewer, name: saved })
      onSaved({ name: saved })
      onNotice('Name updated.')
      onClose()
    } catch (err) {
      onNotice(err instanceof Error ? err.message : 'Could not save that name.')
    } finally {
      setSaving(false)
    }
  }, [name, onClose, onNotice, onSaved, viewer])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 px-4 pb-4 pt-12 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="qari-edit-title"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[22rem] rounded-3xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] px-5 pb-6 pt-5 shadow-[var(--home-card-shadow)]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="ed-focus absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-[var(--home-muted)] transition-colors hover:bg-[var(--app-surface)]"
        >
          <X className="h-4 w-4" strokeWidth={2} />
        </button>

        <h2
          id="qari-edit-title"
          className="home-serif pr-10 text-xl font-semibold text-[var(--home-heading)]"
        >
          Edit profile
        </h2>

        {/* Picture */}
        <div className="mt-5 flex items-center gap-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busyPhoto}
            aria-label="Change profile picture"
            className="ed-focus relative shrink-0 rounded-full transition-transform active:scale-95 disabled:opacity-60"
          >
            <QariAvatar
              username={viewer.username}
              name={name || viewer.name}
              size={72}
              version={avatarVersion}
            />
            <span
              className="absolute -bottom-0.5 -right-0.5 flex h-7 w-7 items-center justify-center rounded-full border-2 border-[var(--home-card-bg)] bg-[var(--home-sage-deep)] text-white"
              aria-hidden
            >
              {busyPhoto ? (
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <Camera className="h-[13px] w-[13px]" strokeWidth={2.2} />
              )}
            </span>
          </button>

          <div className="min-w-0">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busyPhoto}
              className="ed-focus block text-sm font-semibold text-[var(--home-heading)] hover:underline disabled:opacity-60"
            >
              Change photo
            </button>
            {hasAvatar ? (
              <button
                type="button"
                onClick={() => void handleRemovePhoto()}
                disabled={busyPhoto}
                className="ed-focus mt-1 flex items-center gap-1.5 text-xs font-medium text-[var(--home-muted)] transition-colors hover:text-rose-500 disabled:opacity-60"
              >
                <Trash2 className="h-3 w-3" strokeWidth={2} />
                Remove photo
              </button>
            ) : (
              <p className="mt-1 text-xs text-[var(--home-muted)]">JPEG, PNG or WebP.</p>
            )}
          </div>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) void handlePhoto(file)
          }}
        />

        {/* Name */}
        <label
          htmlFor="qari-name"
          className="mb-1.5 mt-6 block text-[10px] font-semibold uppercase tracking-wider text-[var(--home-muted)]"
        >
          Name
        </label>
        <input
          id="qari-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 40))}
          placeholder="Your name"
          className="ed-focus h-11 w-full rounded-xl border border-[var(--home-rule-strong)] bg-[var(--app-surface)] px-3 text-sm font-medium text-[var(--home-heading)] placeholder:font-normal placeholder:text-[var(--home-muted)]"
        />
        <p className="mt-2 text-[11px] leading-relaxed text-[var(--home-muted)]">
          Shown on everything you publish. Your handle{' '}
          <span className="font-semibold text-[var(--home-heading)]">@{viewer.username}</span> stays
          the same — links to your profile keep working.
        </p>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="ed-focus h-11 flex-1 rounded-full border border-[var(--home-rule-strong)] text-sm font-semibold text-[var(--home-heading)] transition-colors hover:bg-[var(--home-track)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || !name.trim()}
            className="ed-ink ed-focus flex h-11 flex-1 items-center justify-center gap-2 rounded-full text-sm font-semibold transition-transform active:scale-[0.98] disabled:opacity-60"
          >
            {saving ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : null}
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
