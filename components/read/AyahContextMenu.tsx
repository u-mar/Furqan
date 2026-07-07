'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Play, Square, Bookmark, Languages, SkipForward, X } from 'lucide-react'
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
  hasNextAyah: boolean
  isReciting: boolean
  isBookmarked: boolean
  somaliVoiceAvailable?: boolean
  isSomaliVoicePlaying?: boolean
  onClose: () => void
  onPlay: () => void
  onToggleBookmark: () => void
  onNextAyah: () => void
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
  hasNextAyah,
  isReciting,
  isBookmarked,
  somaliVoiceAvailable = false,
  isSomaliVoicePlaying = false,
  onClose,
  onPlay,
  onToggleBookmark,
  onNextAyah,
  onPlaySomaliVoice,
  onStopSomaliVoice,
  onStopRecitation,
}: AyahContextMenuProps) {
  const [showTranslation, setShowTranslation] = useState(false)
  const [mounted, setMounted] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const translationRef = useRef<HTMLDivElement>(null)
  const [menuPos, setMenuPos] = useState<{ left: number; top: number; below: boolean } | null>(null)
  const [translationPos, setTranslationPos] = useState<{
    left: number
    top: number
    above: boolean
  } | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) setShowTranslation(false)
  }, [open])

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
    if (!open || !anchor || !menuRef.current) {
      setMenuPos(null)
      setTranslationPos(null)
      return
    }

    const menuRect = menuRef.current.getBoundingClientRect()
    const menuW = menuRect.width || 280
    const menuH = menuRect.height || 44

    let centerX = anchor.left + anchor.width / 2
    const halfW = menuW / 2
    centerX = Math.max(
      VIEWPORT_PAD + halfW,
      Math.min(window.innerWidth - VIEWPORT_PAD - halfW, centerX)
    )

    const anchorBottom = anchor.top + anchor.height
    const spaceAbove = anchor.top - VIEWPORT_PAD
    const spaceBelow = window.innerHeight - anchorBottom - VIEWPORT_PAD
    const placeBelow = spaceAbove < menuH + MENU_GAP && spaceBelow > spaceAbove

    let top: number
    if (placeBelow) {
      top = Math.min(window.innerHeight - VIEWPORT_PAD - menuH, anchorBottom + MENU_GAP)
    } else {
      top = Math.max(VIEWPORT_PAD + menuH, anchor.top - MENU_GAP)
    }

    setMenuPos({ left: centerX, top, below: placeBelow })

    if (showTranslation && translationRef.current) {
      const transRect = translationRef.current.getBoundingClientRect()
      const transW = transRect.width || Math.min(288, window.innerWidth - VIEWPORT_PAD * 2)
      const transH = transRect.height || 80
      let transLeft = centerX
      const transHalf = transW / 2
      transLeft = Math.max(
        VIEWPORT_PAD + transHalf,
        Math.min(window.innerWidth - VIEWPORT_PAD - transHalf, transLeft)
      )

      const menuTop = placeBelow ? top : top - menuH
      const menuBottom = placeBelow ? top + menuH : top
      const viewBottom = window.innerHeight - VIEWPORT_PAD
      const viewTop = VIEWPORT_PAD

      const belowMenu = menuBottom + MENU_GAP
      const aboveMenu = menuTop - transH - MENU_GAP
      const aboveAyah = anchor.top - transH - MENU_GAP

      let transTop: number
      let transAbove = false

      if (belowMenu + transH <= viewBottom) {
        transTop = belowMenu
      } else if (aboveMenu >= viewTop) {
        transTop = aboveMenu
        transAbove = true
      } else if (aboveAyah >= viewTop) {
        transTop = aboveAyah
        transAbove = true
      } else {
        const aboveAyahClamped = Math.max(viewTop, aboveAyah)
        const aboveMenuClamped = Math.max(viewTop, aboveMenu)
        if (aboveAyahClamped >= viewTop) {
          transTop = aboveAyahClamped
          transAbove = true
        } else {
          transTop = aboveMenuClamped
          transAbove = true
        }
        transTop = Math.min(transTop, viewBottom - transH)
      }

      setTranslationPos({ left: transLeft, top: transTop, above: transAbove })
    } else {
      setTranslationPos(null)
    }
  }, [open, anchor, showTranslation, verseKey, somaliVoiceAvailable, translation, translationLoading])

  if (!open || !mounted || !anchor) return null

  const menu = (
    <>
      <div
        ref={menuRef}
        data-ayah-menu
        className="fixed z-[101]"
        style={{
          left: menuPos?.left ?? anchor.left + anchor.width / 2,
          top: menuPos?.top ?? anchor.top - MENU_GAP,
          transform: menuPos?.below ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
          visibility: menuPos ? 'visible' : 'hidden',
        }}
        role="toolbar"
        aria-label={`Ayah ${verseKey} actions`}
      >
        <div
          className={cn(
            'flex items-center gap-0.5 rounded-full border px-1 py-1 shadow-lg backdrop-blur-md',
            'border-stone-200/90 bg-[#faf6ef]/95 text-[#2a2218]',
            'dark:border-white/15 dark:bg-[#1a1a1a]/95 dark:text-stone-100'
          )}
        >
          <button
            type="button"
            onClick={isReciting ? onStopRecitation : onPlay}
            className="flex h-9 w-9 items-center justify-center rounded-full text-teal-700 hover:bg-teal-600/10 dark:text-teal-400 dark:hover:bg-teal-500/15"
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
              'flex h-9 w-9 items-center justify-center rounded-full',
              isBookmarked
                ? 'text-teal-700 dark:text-teal-400'
                : 'text-stone-600 hover:bg-black/5 dark:text-stone-300 dark:hover:bg-white/10'
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
              'flex h-9 w-9 items-center justify-center rounded-full',
              showTranslation
                ? 'bg-teal-600/15 text-teal-700 dark:text-teal-400'
                : 'text-stone-600 hover:bg-black/5 dark:text-stone-300 dark:hover:bg-white/10'
            )}
            aria-label="Show translation"
            aria-pressed={showTranslation}
          >
            <Languages className="h-4 w-4" />
          </button>
          {somaliVoiceAvailable && onPlaySomaliVoice ? (
            <button
              type="button"
              onClick={isSomaliVoicePlaying ? onStopSomaliVoice : onPlaySomaliVoice}
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold',
                isSomaliVoicePlaying
                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                  : 'text-stone-600 hover:bg-black/5 dark:text-stone-300 dark:hover:bg-white/10'
              )}
              aria-label={isSomaliVoicePlaying ? 'Stop Somali voice' : 'Play Somali voice'}
            >
              SO
            </button>
          ) : null}
          <button
            type="button"
            onClick={onNextAyah}
            disabled={!hasNextAyah}
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-full text-stone-600 hover:bg-black/5 dark:text-stone-300 dark:hover:bg-white/10',
              !hasNextAyah && 'cursor-not-allowed opacity-35'
            )}
            aria-label="Next ayah on page"
          >
            <SkipForward className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-stone-500 hover:bg-black/5 dark:hover:bg-white/10"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      {showTranslation && (
        <div
          ref={translationRef}
          data-ayah-menu
          className={cn(
            'fixed z-[101] max-w-[min(18rem,calc(100vw-1.5rem))] -translate-x-1/2 rounded-xl border px-3 py-2.5 shadow-lg backdrop-blur-md',
            'max-h-[min(40vh,calc(100vh-6rem))] overflow-y-auto overscroll-contain',
            'border-stone-200/90 bg-[#faf6ef]/98 text-[#2a2218]',
            'dark:border-white/15 dark:bg-[#1a1a1a]/98 dark:text-stone-100'
          )}
          style={{
            left: translationPos?.left ?? menuPos?.left ?? anchor.left + anchor.width / 2,
            top: translationPos?.top ?? Math.max(VIEWPORT_PAD, anchor.top - 80),
            visibility: translationPos || menuPos ? 'visible' : 'hidden',
          }}
          role="dialog"
          aria-label={`Translation for ayah ${verseKey}`}
        >
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
            {verseKey}
          </p>
          <p className="text-left text-sm leading-relaxed">
            {translationLoading
              ? 'Loading…'
              : translation || 'Translation unavailable.'}
          </p>
        </div>
      )}
    </>
  )

  return createPortal(menu, document.body)
}
