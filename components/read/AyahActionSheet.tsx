'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Play, Languages, X, ChevronLeft, Square, SkipForward } from 'lucide-react'
import { cn } from '@/lib/cn'

interface AyahActionSheetProps {
  verseKey: string
  arabicText: string
  translation: string | null
  translationLoading: boolean
  hasNextAyah: boolean
  open: boolean
  isReciting: boolean
  onClose: () => void
  onPlay: () => void
  onStopRecitation: () => void
  onNextAyah: () => void
}

export default function AyahActionSheet({
  verseKey,
  arabicText,
  translation,
  translationLoading,
  hasNextAyah,
  open,
  isReciting,
  onClose,
  onPlay,
  onStopRecitation,
  onNextAyah,
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
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onPlay}
              className="flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-xl bg-teal-600 text-white"
            >
              <Play className="h-5 w-5 fill-current" />
              <span className="text-sm font-medium">Play</span>
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
        )}

        {view === 'translation' && (
          <div className="space-y-3">
            <div className="rounded-xl bg-[#1a1a1a] px-4 py-3.5">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-stone-500">
                Translation
              </p>
              <p className="text-left text-[15px] leading-relaxed text-stone-100">
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
