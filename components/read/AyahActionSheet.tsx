'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Play, Languages, X, ChevronLeft, Square, SkipForward, Volume2, Bookmark } from 'lucide-react'
import { cn } from '@/lib/cn'

interface AyahActionSheetProps {
  verseKey: string
  arabicText: string
  translation: string | null
  translationLoading: boolean
  hasNextAyah: boolean
  open: boolean
  isReciting: boolean
  isBookmarked: boolean
  onClose: () => void
  onPlay: () => void
  onToggleBookmark: () => void
  onStopRecitation: () => void
  onNextAyah: () => void
  somaliVoiceAvailable?: boolean
  isSomaliVoicePlaying?: boolean
  onPlaySomaliVoice?: () => void
  onStopSomaliVoice?: () => void
}

export default function AyahActionSheet({
  verseKey,
  arabicText,
  translation,
  translationLoading,
  hasNextAyah,
  open,
  isReciting,
  isBookmarked,
  onClose,
  onPlay,
  onToggleBookmark,
  onStopRecitation,
  onNextAyah,
  somaliVoiceAvailable = false,
  isSomaliVoicePlaying = false,
  onPlaySomaliVoice,
  onStopSomaliVoice,
}: AyahActionSheetProps) {
  const [view, setView] = useState<'menu' | 'translation' | 'playing'>('menu')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) setView('menu')
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (view === 'translation' || view === 'playing') setView('menu')
        else onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, view])

  if (!open || !mounted) return null

  const ayahNum = verseKey.split(':')[1] || ''
  const surahNum = verseKey.split(':')[0] || ''
  const displayArabic = arabicText.trim() || 'Arabic text unavailable for this ayah.'

  const nextAyahButton = (
    <button
      type="button"
      onClick={onNextAyah}
      disabled={!hasNextAyah}
      className={cn(
        'flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#1a1a1a] text-sm font-medium text-teal-400',
        !hasNextAyah && 'cursor-not-allowed opacity-40'
      )}
    >
      <SkipForward className="h-5 w-5" />
      Next ayah
    </button>
  )

  const sheet = (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[100] bg-black/45"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        className="fixed inset-x-0 bottom-0 z-[101] mx-auto max-w-lg rounded-t-2xl border border-white/10 bg-[#141414] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label={
          view === 'translation'
            ? `Translation for ayah ${verseKey}`
            : view === 'playing'
              ? `Playing ayah ${verseKey}`
              : `Ayah ${verseKey} actions`
        }
      >
        <div className="mb-3 flex items-center justify-between">
          {view === 'translation' || view === 'playing' ? (
            <button
              type="button"
              onClick={() => {
                if (view === 'playing' && isReciting) onStopRecitation()
                setView('menu')
              }}
              className="flex items-center gap-1 rounded-lg p-2 text-sm text-stone-400 hover:bg-white/5"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </button>
          ) : (
            <p className="text-sm font-medium text-stone-400">Ayah options</p>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-stone-400 hover:bg-white/5"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4 max-h-[min(40vh,220px)] overflow-y-auto overscroll-contain rounded-xl border-2 border-teal-500/50 bg-[#1a1a1a] px-4 py-4">
          <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-teal-400">
            {surahNum}:{ayahNum}
          </p>
          <p
            className="amiri arabic-text ayah-sheet-arabic text-center text-[clamp(1.25rem,5vw,1.65rem)] leading-[2.2]"
            dir="rtl"
            lang="ar"
          >
            {displayArabic}
          </p>
        </div>

        {view === 'menu' && (
          <div className={cn('grid gap-2', somaliVoiceAvailable ? 'grid-cols-2' : 'grid-cols-3')}>
            <button
              type="button"
              onClick={onPlay}
              className="flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-xl bg-teal-600 text-white"
            >
              <Play className="h-5 w-5 fill-current" />
              <span className="text-sm font-medium">Play</span>
            </button>
            {somaliVoiceAvailable && onPlaySomaliVoice && (
              <button
                type="button"
                onClick={() => {
                  if (isSomaliVoicePlaying && onStopSomaliVoice) {
                    onStopSomaliVoice()
                  } else {
                    onPlaySomaliVoice()
                    setView('playing')
                  }
                }}
                className={cn(
                  'flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-xl border text-sm font-medium',
                  isSomaliVoicePlaying
                    ? 'border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300'
                    : 'border-[var(--home-card-border)] bg-[var(--app-surface)] text-[var(--app-text)]'
                )}
              >
                {isSomaliVoicePlaying ? (
                  <Square className="h-5 w-5 fill-current" />
                ) : (
                  <Volume2 className="h-5 w-5" />
                )}
                <span>Somali</span>
              </button>
            )}
            <button
              type="button"
              onClick={onToggleBookmark}
              className={cn(
                'flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-xl border text-sm font-medium',
                isBookmarked
                  ? 'border-teal-500/40 bg-teal-500/15 text-teal-400'
                  : 'border-[var(--home-card-border)] bg-[var(--app-surface)] text-teal-700 dark:text-teal-400'
              )}
              aria-pressed={isBookmarked}
            >
              <Bookmark className={cn('h-5 w-5', isBookmarked && 'fill-current')} />
              <span>{isBookmarked ? 'Saved' : 'Bookmark'}</span>
            </button>
            <button
              type="button"
              onClick={() => setView('translation')}
              className="flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-xl border border-[var(--home-card-border)] bg-[var(--app-surface)] text-teal-700 dark:text-teal-400"
            >
              <Languages className="h-5 w-5" />
              <span className="text-sm font-medium">Text</span>
            </button>
          </div>
        )}

        {view === 'translation' && (
          <div className="space-y-3">
            <div className="rounded-xl bg-[var(--app-surface)] px-4 py-3.5">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--app-muted)]">
                Translation
              </p>
              <p className="text-left text-[15px] leading-relaxed text-[var(--app-text)]">
                {translationLoading
                  ? 'Loading translation…'
                  : translation || 'Translation unavailable.'}
              </p>
            </div>
            {nextAyahButton}
          </div>
        )}

        {view === 'playing' && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onStopRecitation}
                className="flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400"
              >
                <Square className="h-5 w-5 fill-current" />
                <span className="text-sm font-medium">Stop</span>
              </button>
              <button
                type="button"
                onClick={() => setView('translation')}
                className="flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-xl border border-white/10 bg-[#1a1a1a] text-teal-400"
              >
                <Languages className="h-5 w-5" />
                <span className="text-sm font-medium">Translation</span>
              </button>
            </div>
            {nextAyahButton}
          </div>
        )}
      </div>
    </>
  )

  return createPortal(sheet, document.body)
}
