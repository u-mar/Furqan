'use client'

import { useEffect } from 'react'
import { Play, Languages, X } from 'lucide-react'

interface AyahActionSheetProps {
  verseKey: string
  arabicText: string
  translation: string | null
  translationLoading: boolean
  open: boolean
  onClose: () => void
  onPlay: () => void
  onShowTranslation: () => void
}

export default function AyahActionSheet({
  verseKey,
  arabicText,
  translation,
  translationLoading,
  open,
  onClose,
  onPlay,
  onShowTranslation,
}: AyahActionSheetProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const ayahNum = verseKey.split(':')[1] || ''

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px]"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-lg rounded-t-2xl border border-white/10 bg-[#141414] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label={`Ayah ${verseKey} actions`}
      >
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium text-stone-400">Ayah {ayahNum}</p>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-stone-400 hover:bg-white/5" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="arabic-text mb-4 text-center text-[var(--mushaf-read-text)]" dir="rtl" lang="ar">
          {arabicText}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              onPlay()
              onClose()
            }}
            className="flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-xl bg-teal-600 text-white"
          >
            <Play className="h-5 w-5 fill-current" />
            <span className="text-sm font-medium">Play</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onShowTranslation()
              onClose()
            }}
            className="flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-xl border border-white/10 bg-[#1a1a1a] text-teal-400"
          >
            <Languages className="h-5 w-5" />
            <span className="text-sm font-medium">Translation</span>
          </button>
        </div>
        {(translationLoading || translation) && (
          <p className="mt-3 rounded-xl bg-[#1a1a1a] px-3 py-2.5 text-sm leading-relaxed text-stone-300">
            {translationLoading ? 'Loading translation…' : translation}
          </p>
        )}
      </div>
    </>
  )
}

