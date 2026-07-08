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

  const actionButtonBase =
    'flex min-h-[56px] flex-col items-center justify-center gap-1.5 rounded-2xl border text-sm font-semibold transition-all duration-200 active:scale-[0.98]'

  const nextAyahButton = (
    <button
      type="button"
      onClick={onNextAyah}
      disabled={!hasNextAyah}
      className={cn(
        'w-full items-center justify-center gap-2 rounded-2xl px-4',
        actionButtonBase,
        'border-[var(--mushaf-read-popup-border)] bg-white/80 text-[var(--mushaf-read-accent)] shadow-sm backdrop-blur',
        'dark:bg-white/5',
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
        className="fixed inset-0 z-[100] bg-black/35 dark:bg-black/45"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        className={cn(
          'ayah-context-card fixed inset-x-0 bottom-0 z-[101] mx-auto max-w-lg overflow-hidden rounded-t-[1.75rem] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4',
          'border-t shadow-2xl'
        )}
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
        <div className="ayah-context-card__toolbar -mx-4 mb-4 flex items-center justify-between border-b border-black/5 px-4 pb-3 dark:border-white/5">
          {view === 'translation' || view === 'playing' ? (
            <button
              type="button"
              onClick={() => {
                if (view === 'playing' && isReciting) onStopRecitation()
                setView('menu')
              }}
              className="flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-medium text-[var(--mushaf-read-meta)] transition-colors hover:bg-black/5 dark:hover:bg-white/5"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </button>
          ) : (
            <div>
              <p className="text-sm font-semibold text-[var(--mushaf-read-text)]">Ayah options</p>
              <p className="text-xs text-[var(--mushaf-read-meta)]">Quick actions and translation</p>
            </div>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-[var(--mushaf-read-meta)] transition-colors hover:bg-black/5 dark:hover:bg-white/5"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div
          className={cn(
            'mb-5 max-h-[min(40vh,220px)] overflow-y-auto overscroll-contain rounded-[1.4rem] border px-5 py-5',
            'bg-gradient-to-br from-white/85 via-white/65 to-[var(--mushaf-read-accent-soft)]',
            'border-[var(--mushaf-read-popup-border)] shadow-[inset_0_1px_0_rgba(255,255,255,0.38)]',
            'dark:from-white/8 dark:via-white/5 dark:to-[var(--mushaf-read-accent-soft)]'
          )}
        >
          <p className="mb-3 text-center text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--mushaf-read-accent)]">
            {surahNum}:{ayahNum}
          </p>
          <p
            className="amiri arabic-text ayah-sheet-arabic text-center text-[clamp(1.3rem,5vw,1.8rem)] leading-[2.2]"
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
              className={cn(
                actionButtonBase,
                'border-transparent bg-[var(--mushaf-read-accent)] text-white shadow-lg shadow-teal-950/15'
              )}
            >
              <Play className="h-5 w-5 fill-current" />
              <span className="text-sm font-medium">Play</span>
            </button>
            {somaliVoiceAvailable && onPlaySomaliVoice ? (
              <button
                type="button"
                onClick={() => {
                  if (isSomaliVoicePlaying && onStopSomaliVoice) {
                    onStopSomaliVoice()
                  } else {
                    onPlaySomaliVoice()
                  }
                }}
                className={cn(
                  actionButtonBase,
                  isSomaliVoicePlaying
                    ? 'border-amber-500/40 bg-amber-500/15 text-amber-800 shadow-sm dark:text-amber-300'
                    : 'border-[var(--mushaf-read-popup-border)] bg-white/80 text-[var(--mushaf-read-popup-text)] shadow-sm backdrop-blur dark:bg-white/5'
                )}
              >
                {isSomaliVoicePlaying ? (
                  <Square className="h-5 w-5 fill-current" />
                ) : (
                  <Volume2 className="h-5 w-5" />
                )}
                <span>Somali</span>
              </button>
            ) : null}
            <button
              type="button"
              onClick={onToggleBookmark}
              className={cn(
                actionButtonBase,
                isBookmarked
                  ? 'border-teal-500/40 bg-teal-500/15 text-[var(--mushaf-read-accent)] shadow-sm'
                  : 'border-[var(--mushaf-read-popup-border)] bg-white/80 text-[var(--mushaf-read-accent)] shadow-sm backdrop-blur dark:bg-white/5'
              )}
              aria-pressed={isBookmarked}
            >
              <Bookmark className={cn('h-5 w-5', isBookmarked && 'fill-current')} />
              <span>{isBookmarked ? 'Saved' : 'Bookmark'}</span>
            </button>
            <button
              type="button"
              onClick={() => setView('translation')}
              className={cn(
                actionButtonBase,
                'border-[var(--mushaf-read-popup-border)] bg-white/80 text-[var(--mushaf-read-accent)] shadow-sm backdrop-blur dark:bg-white/5'
              )}
            >
              <Languages className="h-5 w-5" />
              <span className="text-sm font-medium">Text</span>
            </button>
          </div>
        )}

        {view === 'translation' && (
          <div className="space-y-3">
            <div
              className={cn(
                'rounded-[1.35rem] px-4 py-4',
                'bg-white/80 ring-1 ring-[var(--mushaf-read-popup-border)] shadow-sm backdrop-blur',
                'dark:bg-white/5'
              )}
            >
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--mushaf-read-meta)]">
                Translation
              </p>
              <p className="text-left text-[15px] leading-relaxed text-[var(--mushaf-read-popup-text)]">
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
                className={cn(
                  actionButtonBase,
                  'border border-red-500/30 bg-red-500/10 text-red-600 shadow-sm dark:text-red-400'
                )}
              >
                <Square className="h-5 w-5 fill-current" />
                <span className="text-sm font-medium">Stop</span>
              </button>
              <button
                type="button"
                onClick={() => setView('translation')}
                className={cn(
                  actionButtonBase,
                  'border-[var(--mushaf-read-popup-border)] bg-white/80 text-[var(--mushaf-read-accent)] shadow-sm backdrop-blur dark:bg-white/5'
                )}
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
