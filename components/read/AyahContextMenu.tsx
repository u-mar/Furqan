'use client'

import { useEffect, useState } from 'react'
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

  if (!open || !mounted || !anchor) return null

  const centerX = anchor.left + anchor.width / 2
  const menuTop = Math.max(12, anchor.top - 8)
  const translationTop = menuTop + 48

  const menu = (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[100] bg-transparent"
        aria-label="Close ayah menu"
        onClick={onClose}
      />
      <div
        className="fixed z-[101] -translate-x-1/2 -translate-y-full"
        style={{ left: centerX, top: menuTop }}
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
          className={cn(
            'fixed z-[101] max-w-[min(18rem,calc(100vw-1.5rem))] -translate-x-1/2 rounded-xl border px-3 py-2.5 shadow-lg backdrop-blur-md',
            'border-stone-200/90 bg-[#faf6ef]/98 text-[#2a2218]',
            'dark:border-white/15 dark:bg-[#1a1a1a]/98 dark:text-stone-100'
          )}
          style={{ left: centerX, top: translationTop }}
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
