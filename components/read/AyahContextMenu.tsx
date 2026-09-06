'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Play, Square, Bookmark, Languages, Share2, X } from 'lucide-react'
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
  onShare?: () => void
  onPlaySomaliVoice?: () => void
  onStopSomaliVoice?: () => void
  onStopRecitation?: () => void
}

const VIEWPORT_PAD = 12
const MENU_GAP = 10

interface ActionButtonProps {
  label: string
  active?: boolean
  primary?: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}

function ActionButton({ label, active, primary, disabled, onClick, children }: ActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl px-1 py-1.5 transition-colors disabled:opacity-60"
    >
      <span
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-full transition-all active:scale-90',
          primary
            ? 'bg-[var(--mushaf-read-accent)] text-white shadow-[0_8px_18px_-8px_var(--mushaf-read-accent)]'
            : active
              ? 'bg-[var(--mushaf-read-accent-soft)] text-[var(--mushaf-read-accent)] ring-1 ring-[var(--mushaf-read-accent)]/40'
              : 'bg-[var(--mushaf-popup-badge-bg)] text-[var(--mushaf-read-popup-text)] group-hover:bg-[var(--mushaf-read-accent-soft)]'
        )}
      >
        {children}
      </span>
      <span
        className={cn(
          'w-full truncate text-center text-[10px] font-medium leading-none',
          active || primary
            ? 'text-[var(--mushaf-read-accent)]'
            : 'text-[var(--mushaf-popup-meta)]'
        )}
      >
        {label}
      </span>
    </button>
  )
}

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
  onShare,
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

  const anchorCenterX = anchor.left + anchor.width / 2
  const caretLeft = cardPos
    ? Math.max(18, Math.min((cardRef.current?.offsetWidth ?? 300) - 18, anchorCenterX - (cardPos.left - (cardRef.current?.offsetWidth ?? 300) / 2)))
    : 0

  const menu = (
    <div
      ref={cardRef}
      data-ayah-menu
      className="fixed z-[101] w-[min(19rem,calc(100vw-1.25rem))] overflow-visible rounded-2xl border text-[var(--mushaf-read-popup-text)]"
      style={{
        left: cardPos?.left ?? anchor.left + anchor.width / 2,
        top: cardPos?.top ?? anchor.top - MENU_GAP,
        transform: cardPos?.below ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
        visibility: cardPos ? 'visible' : 'hidden',
        background: 'var(--mushaf-read-popup-bg)',
        borderColor: 'var(--mushaf-read-popup-border)',
        boxShadow: 'var(--mushaf-read-popup-shadow, 0 18px 44px rgba(0,0,0,0.4))',
        backdropFilter: 'blur(8px)',
      }}
      role="dialog"
      aria-label={`Ayah ${verseKey} actions`}
    >
      {/* pointer caret */}
      <span
        aria-hidden
        className="absolute h-3 w-3 rotate-45 border"
        style={{
          left: caretLeft || '50%',
          [cardPos?.below ? 'top' : 'bottom']: -6,
          marginLeft: caretLeft ? -6 : 0,
          background: 'var(--mushaf-read-popup-bg)',
          borderColor: 'var(--mushaf-read-popup-border)',
          borderTopColor: cardPos?.below ? 'var(--mushaf-read-popup-border)' : 'transparent',
          borderLeftColor: cardPos?.below ? 'var(--mushaf-read-popup-border)' : 'transparent',
          borderBottomColor: cardPos?.below ? 'transparent' : 'var(--mushaf-read-popup-border)',
          borderRightColor: cardPos?.below ? 'transparent' : 'var(--mushaf-read-popup-border)',
        }}
      />

      {/* header */}
      <div className="flex items-center justify-between px-3.5 pt-2.5">
        <span className="rounded-full bg-[var(--mushaf-popup-badge-bg)] px-2.5 py-0.5 text-[11px] font-bold tabular-nums text-[var(--mushaf-read-accent)]">
          {verseKey}
        </span>
        <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--mushaf-popup-meta)]">
          Ayah actions
        </span>
      </div>

      {showTranslation && (
        <div className="mx-3.5 mt-2 rounded-xl bg-[var(--mushaf-popup-badge-bg)] px-3 py-2.5">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--mushaf-read-accent)]">
            Translation
          </p>
          <p className="max-h-[min(30vh,11.5rem)] overflow-y-auto overscroll-contain text-left text-[13px] leading-relaxed text-[var(--mushaf-read-popup-text)]">
            {translationLoading ? 'Loading…' : translation || 'Translation unavailable.'}
          </p>
        </div>
      )}

      {/* toolbar */}
      <div
        className="flex items-stretch justify-around px-1.5 pb-2 pt-1.5"
        role="toolbar"
        aria-label={`Ayah ${verseKey} actions`}
      >
        <ActionButton
          label={isReciting ? 'Stop' : 'Play'}
          primary
          onClick={isReciting ? () => onStopRecitation?.() : onPlay}
        >
          {isReciting ? (
            <Square className="h-4 w-4 fill-current" />
          ) : (
            <Play className="h-4 w-4 fill-current" />
          )}
        </ActionButton>

        <ActionButton
          label={isBookmarked ? 'Saved' : 'Save'}
          active={isBookmarked}
          onClick={onToggleBookmark}
        >
          <Bookmark className={cn('h-[18px] w-[18px]', isBookmarked && 'fill-current')} />
        </ActionButton>

        <ActionButton
          label="Translate"
          active={showTranslation}
          onClick={() => setShowTranslation((v) => !v)}
        >
          <Languages className="h-[18px] w-[18px]" />
        </ActionButton>

        {onShare ? (
          <ActionButton label="Share" onClick={onShare}>
            <Share2 className="h-[18px] w-[18px]" />
          </ActionButton>
        ) : null}

        {somaliVoiceAvailable && onPlaySomaliVoice ? (
          <ActionButton
            label="Somali"
            active={isSomaliVoicePlaying}
            onClick={isSomaliVoicePlaying ? () => onStopSomaliVoice?.() : onPlaySomaliVoice}
          >
            <span className="text-xs font-bold">SO</span>
          </ActionButton>
        ) : null}

        <ActionButton label="Close" onClick={onClose}>
          <X className="h-[18px] w-[18px]" />
        </ActionButton>
      </div>
    </div>
  )

  return createPortal(menu, document.body)
}
