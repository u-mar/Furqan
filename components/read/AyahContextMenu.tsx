'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Play, Square, Bookmark, Languages, X } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface AyahMenuAnchor {
  top: number
  left: number
  width: number
  height: number
}

interface AyahContextMenuProps {
  open: boolean
  verseKey: string
  anchor: AyahMenuAnchor | null
  translation: string | null
  translationLoading: boolean
  isReciting: boolean
  isBookmarked: boolean
  somaliVoiceAvailable?: boolean
  isSomaliVoicePlaying?: boolean
  onClose: () => void
  onPlay: () => void
  onToggleBookmark: () => void
  onPlaySomaliVoice?: () => void
  onStopSomaliVoice?: () => void
  onStopRecitation?: () => void
}

const VIEWPORT_PAD = 12
const MENU_GAP = 8

export default function AyahContextMenu({
  open,
  verseKey,
  anchor,
  translation,
  translationLoading,
  isReciting,
  isBookmarked,
  somaliVoiceAvailable = false,
  isSomaliVoicePlaying = false,
  onClose,
  onPlay,
  onToggleBookmark,
  onPlaySomaliVoice,
  onStopSomaliVoice,
  onStopRecitation,
}: AyahContextMenuProps) {
  const [showTranslation, setShowTranslation] = useState(false)
  const [mounted, setMounted] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const [cardPos, setCardPos] = useState<{ left: number; top: number; below: boolean } | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) setShowTranslation(false)
  }, [open])

  useEffect(() => {
    setShowTranslation(false)
  }, [verseKey])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('[data-ayah-menu]')) return
      if (target.closest('[data-verse-key], [data-verse-keys], [data-translation-ayah]')) return
      onClose()
    }
    window.addEventListener('pointerdown', onPointerDown)
    return () => window.removeEventListener('pointerdown', onPointerDown)
  }, [open, onClose])

  useLayoutEffect(() => {
    if (!open || !anchor || !cardRef.current) {
      setCardPos(null)
      return
    }

    const cardRect = cardRef.current.getBoundingClientRect()
    const cardW = cardRect.width || 300
    const cardH = cardRect.height || 44

    let centerX = anchor.left + anchor.width / 2
    const halfW = cardW / 2
    centerX = Math.max(
      VIEWPORT_PAD + halfW,
      Math.min(window.innerWidth - VIEWPORT_PAD - halfW, centerX)
    )

    const anchorBottom = anchor.top + anchor.height
    const spaceAbove = anchor.top - VIEWPORT_PAD
    const spaceBelow = window.innerHeight - anchorBottom - VIEWPORT_PAD
    const placeBelow = spaceAbove < cardH + MENU_GAP && spaceBelow > spaceAbove

    let top: number
    if (placeBelow) {
      top = Math.min(window.innerHeight - VIEWPORT_PAD - cardH, anchorBottom + MENU_GAP)
    } else {
      top = Math.max(VIEWPORT_PAD + cardH, anchor.top - MENU_GAP)
    }

    setCardPos({ left: centerX, top, below: placeBelow })
  }, [open, anchor, showTranslation, verseKey, somaliVoiceAvailable, translation, translationLoading])

  if (!open || !mounted || !anchor) return null

  const menu = (
    <div
      ref={cardRef}
      data-ayah-menu
      className={cn(
        'fixed z-[101] w-[min(17.5rem,calc(100vw-1.25rem))] overflow-hidden rounded-xl border border-teal-500/45 bg-teal-950/98 text-teal-50 shadow-[0_18px_40px_rgba(0,0,0,0.45)]'
      )}
      style={{
        left: cardPos?.left ?? anchor.left + anchor.width / 2,
        top: cardPos?.top ?? anchor.top - MENU_GAP,
        transform: cardPos?.below ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
        visibility: cardPos ? 'visible' : 'hidden',
      }}
      role="dialog"
      aria-label={`Ayah ${verseKey} actions`}
    >
      {showTranslation && (
        <div className="border-b border-teal-500/20 bg-teal-950/70 px-3 py-2">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-teal-200">
              Translation · {verseKey}
            </p>
            <button
              type="button"
              onClick={() => setShowTranslation(false)}
              className="flex h-7 w-7 items-center justify-center rounded-full text-teal-200 hover:bg-teal-500/15"
              aria-label="Hide translation"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="max-h-[min(30vh,11.5rem)] overflow-y-auto overscroll-contain text-left text-sm leading-relaxed text-teal-50/90">
            {translationLoading ? 'Loading…' : translation || 'Translation unavailable.'}
          </p>
        </div>
      )}

      <div
        className="flex items-center justify-center gap-1 bg-teal-900/80 px-2 py-1.5"
        role="toolbar"
        aria-label={`Ayah ${verseKey} actions`}
      >
        <button
          type="button"
          onClick={isReciting ? onStopRecitation : onPlay}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-700 text-white shadow-sm hover:bg-teal-600"
          aria-label={isReciting ? 'Stop recitation' : 'Play from this ayah'}
        >
          {isReciting ? (
            <Square className="h-4 w-4 fill-current" />
          ) : (
            <Play className="h-4 w-4 fill-current" />
          )}
        </button>
        <button
          type="button"
          onClick={onToggleBookmark}
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-full',
            isBookmarked
              ? 'bg-teal-500/20 text-teal-200'
              : 'text-teal-200 hover:bg-teal-500/15'
          )}
          aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark ayah'}
          aria-pressed={isBookmarked}
        >
          <Bookmark className={cn('h-4 w-4', isBookmarked && 'fill-current')} />
        </button>
        <button
          type="button"
          onClick={() => setShowTranslation((v) => !v)}
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-full',
            showTranslation
              ? 'bg-teal-500/20 text-teal-200'
              : 'text-teal-200 hover:bg-teal-500/15'
          )}
          aria-label={showTranslation ? 'Hide translation' : 'Show translation'}
          aria-pressed={showTranslation}
        >
          <Languages className="h-4 w-4" />
        </button>
        {somaliVoiceAvailable && onPlaySomaliVoice ? (
          <button
            type="button"
            onClick={isSomaliVoicePlaying ? onStopSomaliVoice : onPlaySomaliVoice}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold',
              isSomaliVoicePlaying
                ? 'bg-amber-500/15 text-amber-200'
                : 'text-teal-200 hover:bg-teal-500/15'
            )}
            aria-label={isSomaliVoicePlaying ? 'Stop Somali voice' : 'Play Somali voice'}
          >
            SO
          </button>
        ) : null}
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-full text-teal-200 hover:bg-teal-500/15"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )

  return createPortal(menu, document.body)
}
