'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { avatarUrl } from '@/components/qari/QariAvatar'
import { useT } from '@/lib/i18n'
import { useCloseOnBack } from '@/lib/native-back'
import { lockPageScroll } from '@/lib/scroll-lock'

/**
 * A qari's picture shown large, as a short-video app does when the picture on a profile is tapped:
 * round, over the dimmed profile. A tap anywhere, or back, puts it away.
 */
export default function AvatarViewer({
  open,
  username,
  name,
  version,
  onClose,
}: {
  open: boolean
  username: string
  name: string
  version?: number
  onClose: () => void
}) {
  const t = useT()
  useCloseOnBack(open, onClose)
  useEffect(() => (open ? lockPageScroll() : undefined), [open])
  // Grows from small on opening, a frame after it is drawn.
  const [shown, setShown] = useState(false)
  useEffect(() => {
    if (!open) {
      setShown(false)
      return
    }
    const frame = requestAnimationFrame(() => setShown(true))
    return () => cancelAnimationFrame(frame)
  }, [open])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-black/80 backdrop-blur-md transition-opacity duration-200"
      style={{ opacity: shown ? 1 : 0 }}
      role="dialog"
      aria-modal="true"
      aria-label={t('Profile picture of {name}', { name })}
      onClick={onClose}
    >
      <img
        src={avatarUrl(username, version)}
        alt={t('Profile picture of {name}', { name })}
        className="aspect-square rounded-full object-cover shadow-2xl transition-transform duration-200 ease-out"
        style={{ width: 'min(78vw, 22rem)', transform: shown ? 'scale(1)' : 'scale(0.6)' }}
      />
      <p className="mt-5 max-w-[80vw] truncate text-base font-semibold text-white">{name}</p>
      <p className="mt-0.5 text-sm text-white/60">@{username}</p>
    </div>,
    document.body
  )
}
