'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/cn'

export function avatarUrl(username: string, version?: number): string {
  const base = `/api/qari/avatar/${encodeURIComponent(username.toLowerCase())}`
  return version ? `${base}?v=${version}` : base
}

/**
 * A qari's picture, drawn over their initial.
 *
 * The initial is always in the DOM and the picture fades in on top of it, so
 * there is never an empty circle while the request is in flight, and a 404
 * (the normal answer for "no picture set") simply never fades in. That also
 * survives an image that resolves before React hydrates, which an onError
 * handler alone would miss.
 */
export default function QariAvatar({
  username,
  name,
  size = 44,
  version,
  className,
  showInitial = true,
  onPictureChange,
}: {
  username: string
  name: string
  size?: number
  /** Bump to bypass the cache after uploading a new picture. */
  version?: number
  className?: string
  /** Off when something is drawn on top of the avatar, such as a play button. */
  showInitial?: boolean
  /** Told whether a real picture is showing, so callers can adapt around it. */
  onPictureChange?: (hasPicture: boolean) => void
}) {
  const src = avatarUrl(username, version)
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const initial = (name || username || '?').trim().charAt(0).toUpperCase()

  const hasPicture = loadedSrc === src

  // Held in a ref so an inline callback does not re-fire the effect each render.
  const notify = useRef(onPictureChange)
  useEffect(() => {
    notify.current = onPictureChange
  })
  useEffect(() => {
    notify.current?.(hasPicture)
  }, [hasPicture])

  useEffect(() => {
    const img = imgRef.current
    if (!img) return
    // A picture often finishes loading before React hydrates, and the `load`
    // it fired then is gone — so read the element's own state first and only
    // listen if it is still in flight.
    const settle = () => {
      if (img.naturalWidth > 0) setLoadedSrc(src)
    }
    if (img.complete) {
      settle()
      return
    }
    img.addEventListener('load', settle)
    return () => img.removeEventListener('load', settle)
  }, [src])

  return (
    <span
      className={cn(
        'ed-ink home-serif relative flex shrink-0 items-center justify-center overflow-hidden rounded-full font-medium',
        className
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
    >
      {showInitial ? initial : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={src}
        ref={imgRef}
        src={src}
        alt=""
        onLoad={() => setLoadedSrc(src)}
        className="absolute inset-0 h-full w-full object-cover"
        // Inline so the fade cannot depend on a utility class surviving the build.
        style={{
          opacity: hasPicture ? 1 : 0,
          transition: 'opacity 200ms ease',
        }}
      />
    </span>
  )
}

/**
 * Shrink and re-encode a picked image before upload — avatars are displayed
 * small, and sending a 4MB phone photo for a 96px circle wastes everyone's
 * bandwidth and storage.
 */
export async function prepareAvatar(file: File, size = 256): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const side = Math.min(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not process that image.')

  // Centre-crop to a square, then scale down.
  ctx.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    size,
    size
  )
  bitmap.close()

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not process that image.'))),
      'image/jpeg',
      0.85
    )
  })
}

export async function uploadAvatar(
  file: File,
  user: { id: string; username: string }
): Promise<void> {
  const blob = await prepareAvatar(file)
  const form = new FormData()
  form.append('image', blob, 'avatar.jpg')
  form.append('username', user.username)
  form.append('userId', user.id)

  const res = await fetch('/api/qari/avatar', { method: 'POST', body: form })
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(data.error || 'Could not save that picture.')
  }
}

export async function removeAvatar(user: { id: string; username: string }): Promise<void> {
  const params = new URLSearchParams({ username: user.username, userId: user.id })
  const res = await fetch(`/api/qari/avatar?${params.toString()}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Could not remove that picture.')
}
