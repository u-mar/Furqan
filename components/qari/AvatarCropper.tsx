'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ZoomIn, ZoomOut } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { useCloseOnBack } from '@/lib/native-back'
import { lockPageScroll } from '@/lib/scroll-lock'

/** The saved picture's side: sharp in the full-size view (AvatarViewer), still small to send. */
export const AVATAR_SIDE = 640
/** How far in the picture can be zoomed, past the size that just fills the circle. */
const MAX_ZOOM = 4

interface Crop {
  /** Picture's scale on screen, in screen px per picture px. */
  scale: number
  /** Where the picture's centre is, from the circle's centre, in screen px. */
  x: number
  y: number
}

/**
 * Choosing what part of a photo becomes the profile picture: the photo behind a round frame, moved by
 * dragging and zoomed by pinching (or the slider, or a mouse wheel). Gives back a square JPEG of the
 * part inside the frame.
 */
export default function AvatarCropper({
  file,
  onCancel,
  onDone,
}: {
  /** The photo picked; nothing shows while it is null. */
  file: File | null
  onCancel: () => void
  onDone: (picture: Blob) => void
}) {
  const t = useT()
  const open = file !== null
  useCloseOnBack(open, onCancel)
  useEffect(() => (open ? lockPageScroll() : undefined), [open])

  const [src, setSrc] = useState<string | null>(null)
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null)
  const [failed, setFailed] = useState(false)
  const [frame, setFrame] = useState(300)
  const [crop, setCrop] = useState<Crop>({ scale: 1, x: 0, y: 0 })
  const [saving, setSaving] = useState(false)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<{ crop: Crop; distance: number; mid: { x: number; y: number } } | null>(null)

  useEffect(() => {
    if (!file) return
    const url = URL.createObjectURL(file)
    setSrc(url)
    setNatural(null)
    setFailed(false)
    setSaving(false)
    return () => URL.revokeObjectURL(url)
  }, [file])

  // The frame: as wide as the phone allows, less a margin, and no wider than 360px.
  useEffect(() => {
    if (!open) return
    const measure = () => setFrame(Math.round(Math.min(window.innerWidth - 48, window.innerHeight - 260, 360)))
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [open])

  /** The scale at which the photo just covers the frame. */
  const coverScale = natural ? frame / Math.min(natural.w, natural.h) : 1

  /** Keeps the photo covering the whole frame, and its zoom within bounds. */
  const settle = useCallback(
    (next: Crop): Crop => {
      if (!natural) return next
      const scale = Math.min(coverScale * MAX_ZOOM, Math.max(coverScale, next.scale))
      const maxX = Math.max(0, (natural.w * scale - frame) / 2)
      const maxY = Math.max(0, (natural.h * scale - frame) / 2)
      return { scale, x: Math.min(maxX, Math.max(-maxX, next.x)), y: Math.min(maxY, Math.max(-maxY, next.y)) }
    },
    [coverScale, frame, natural]
  )

  // A new photo, or a new frame size, starts centred and just filling the frame.
  useEffect(() => {
    if (natural) setCrop({ scale: coverScale, x: 0, y: 0 })
  }, [natural, coverScale])

  const zoomTo = useCallback(
    (scale: number) => setCrop((c) => settle({ scale, x: (c.x * scale) / c.scale, y: (c.y * scale) / c.scale })),
    [settle]
  )

  const startGesture = () => {
    const points = [...pointers.current.values()]
    if (points.length === 0) {
      gesture.current = null
      return
    }
    const [a, b] = points
    gesture.current = {
      crop,
      distance: b ? Math.hypot(a.x - b.x, a.y - b.y) : 0,
      mid: b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : { ...a },
    }
  }

  const onPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    startGesture()
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const start = gesture.current
    if (!start) return
    const [a, b] = [...pointers.current.values()]
    if (b && start.distance > 0) {
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      const scale = start.crop.scale * (Math.hypot(a.x - b.x, a.y - b.y) / start.distance)
      const ratio = scale / start.crop.scale
      setCrop(
        settle({
          scale,
          x: start.crop.x * ratio + (mid.x - start.mid.x),
          y: start.crop.y * ratio + (mid.y - start.mid.y),
        })
      )
    } else {
      setCrop(settle({ ...start.crop, x: start.crop.x + (a.x - start.mid.x), y: start.crop.y + (a.y - start.mid.y) }))
    }
  }

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId)
    // The finger left on the screen carries on from where the photo is now.
    startGesture()
  }

  const save = async () => {
    const img = imgRef.current
    if (!img || !natural || saving) return
    setSaving(true)
    try {
      const canvas = document.createElement('canvas')
      canvas.width = AVATAR_SIDE
      canvas.height = AVATAR_SIDE
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('no canvas')
      // The frame's top-left corner, in the photo's own pixels.
      const side = frame / crop.scale
      const left = natural.w / 2 - (frame / 2 + crop.x) / crop.scale
      const top = natural.h / 2 - (frame / 2 + crop.y) / crop.scale
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, left, top, side, side, 0, 0, AVATAR_SIDE, AVATAR_SIDE)
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88))
      if (!blob) throw new Error('no blob')
      onDone(blob)
    } catch {
      setSaving(false)
      setFailed(true)
    }
  }

  if (!open || typeof document === 'undefined') return null

  const minScale = coverScale
  const maxScale = coverScale * MAX_ZOOM

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex flex-col bg-black text-white"
      role="dialog"
      aria-modal="true"
      aria-label={t('Move and zoom')}
    >
      {/* The bars stay over the photo, which reaches past the frame when zoomed in. */}
      <div className="relative z-10 flex items-center justify-between bg-black px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button type="button" onClick={onCancel} className="ed-focus h-10 rounded-full px-3 text-sm font-semibold text-white/80">
          {t('Cancel')}
        </button>
        <p className="text-sm font-semibold">{t('Move and zoom')}</p>
        <button
          type="button"
          onClick={() => void save()}
          disabled={!natural || saving}
          className="ed-focus flex h-10 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-black disabled:opacity-50"
        >
          {saving ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" /> : null}
          {t('Save')}
        </button>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center">
        <div
          className="relative touch-none select-none"
          style={{ width: frame, height: frame }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={(e) => zoomTo(crop.scale * (e.deltaY < 0 ? 1.08 : 1 / 1.08))}
        >
          {src ? (
            <img
              ref={imgRef}
              src={src}
              alt=""
              draggable={false}
              onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
              onError={() => setFailed(true)}
              className="pointer-events-none absolute left-1/2 top-1/2 max-w-none"
              style={{
                width: natural ? natural.w : undefined,
                height: natural ? natural.h : undefined,
                transform: `translate(-50%, -50%) translate(${crop.x}px, ${crop.y}px) scale(${crop.scale})`,
                transformOrigin: 'center',
                opacity: natural ? 1 : 0,
              }}
            />
          ) : null}
          {/* The round frame: everything outside it dimmed, a hairline around it. */}
          <div
            className="pointer-events-none absolute inset-0 rounded-full"
            style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.62), inset 0 0 0 1.5px rgba(255,255,255,0.85)' }}
            aria-hidden
          />
        </div>
      </div>

      <div className="relative z-10 bg-black px-8 pb-[max(1.75rem,env(safe-area-inset-bottom))] pt-4">
        {failed ? (
          <p className="mb-3 text-center text-sm text-rose-300">{t('Could not open that picture. Try another photo.')}</p>
        ) : (
          <p className="mb-3 text-center text-xs text-white/60">{t('Drag to move, pinch to zoom')}</p>
        )}
        <div className="flex items-center gap-3">
          <ZoomOut className="h-4 w-4 shrink-0 text-white/60" strokeWidth={2} aria-hidden />
          <input
            type="range"
            min={0}
            max={1000}
            value={natural ? Math.round(((crop.scale - minScale) / (maxScale - minScale)) * 1000) : 0}
            onChange={(e) => zoomTo(minScale + (Number(e.target.value) / 1000) * (maxScale - minScale))}
            disabled={!natural}
            aria-label={t('Zoom')}
            className="h-1 flex-1 cursor-pointer accent-white"
          />
          <ZoomIn className="h-4 w-4 shrink-0 text-white/60" strokeWidth={2} aria-hidden />
        </div>
      </div>
    </div>,
    document.body
  )
}
