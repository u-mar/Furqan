'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Download, Loader2, RotateCcw, Share2, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import {
  DEFAULT_BACKGROUND_ID,
  VERSE_IMAGE_BACKGROUNDS,
  renderVerseImage,
  shareVerseBlob,
} from '@/lib/verse-image'

export interface ShareVerseTarget {
  verseKey: string
  surahName: string
  /** Mushaf page — picks the QCF glyph font. */
  page: number
  /** QCF glyph code per word, in reading order (empty if unavailable). */
  qcfWords: string[]
  /** Plain Uthmani text per word, in reading order — the fallback. */
  plainWords: string[]
}

interface ShareVerseSheetProps {
  open: boolean
  target: ShareVerseTarget | null
  /** Arrives asynchronously — the preview re-renders once it lands. */
  translation: string | null
  translationLoading: boolean
  onClose: () => void
}

export default function ShareVerseSheet({
  open,
  target,
  translation,
  translationLoading,
  onClose,
}: ShareVerseSheetProps) {
  const [mounted, setMounted] = useState(false)
  const [backgroundId, setBackgroundId] = useState(DEFAULT_BACKGROUND_ID)
  const [range, setRange] = useState<{ start: number; end: number } | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [rendering, setRendering] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const previewUrlRef = useRef<string | null>(null)
  const blobRef = useRef<Blob | null>(null)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  /* A new ayah resets the selection. */
  useEffect(() => {
    setRange(null)
  }, [target?.verseKey])

  const useQcf = Boolean(target?.qcfWords.length)
  /** Words shown in the picker are always readable Uthmani, even when the card draws glyphs. */
  const pickerWords = target?.plainWords ?? []
  const sourceWords = useQcf ? target?.qcfWords ?? [] : pickerWords

  const selection = useMemo(() => {
    const total = sourceWords.length
    if (!total) return { words: [] as string[], partial: false }
    const start = range ? Math.min(range.start, range.end) : 0
    const end = range ? Math.max(range.start, range.end) : total - 1
    return {
      words: sourceWords.slice(start, end + 1),
      partial: start > 0 || end < total - 1,
    }
  }, [range, sourceWords])

  /* Render (and re-render) the card as background, range or translation change. */
  useEffect(() => {
    if (!open || !target || selection.words.length === 0) return
    let cancelled = false
    setRendering(true)

    void (async () => {
      try {
        const blob = await renderVerseImage({
          words: selection.words,
          page: target.page,
          isQcf: useQcf,
          // A partial selection with a full-ayah translation would be a
          // mismatch, so the translation only rides along with the whole ayah.
          translation: selection.partial ? null : translation,
          surahName: target.surahName,
          verseKey: target.verseKey,
          partial: selection.partial,
          backgroundId,
        })
        if (cancelled) return
        blobRef.current = blob
        const url = URL.createObjectURL(blob)
        if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
        previewUrlRef.current = url
        setPreviewUrl(url)
      } catch (err) {
        if (!cancelled) setNotice(err instanceof Error ? err.message : 'Could not build the card.')
      } finally {
        if (!cancelled) setRendering(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [open, target, translation, backgroundId, selection, useQcf])

  /* Drop the object URL when the sheet closes. */
  useEffect(() => {
    if (open) return
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }
    blobRef.current = null
    setPreviewUrl(null)
    setNotice(null)
  }, [open])

  const handleWordTap = useCallback((index: number) => {
    setRange((prev) => {
      // First tap starts a selection; second tap closes it; third starts over.
      if (!prev || prev.start !== prev.end) return { start: index, end: index }
      return { start: prev.start, end: index }
    })
  }, [])

  const handleShare = useCallback(async () => {
    const blob = blobRef.current
    if (!blob || !target || busy) return
    setBusy(true)
    setNotice(null)
    try {
      const result = await shareVerseBlob(blob, {
        verseKey: target.verseKey,
        surahName: target.surahName,
      })
      if (result === 'shared') onClose()
      else setNotice('Saved to your downloads.')
    } catch (err) {
      console.error('Share verse failed:', err)
      setNotice(err instanceof Error ? err.message : 'Could not share the card.')
    } finally {
      setBusy(false)
    }
  }, [busy, onClose, target])

  const handleDownload = useCallback(() => {
    const url = previewUrlRef.current
    if (!url || !target) return
    const link = document.createElement('a')
    link.href = url
    link.download = `${target.surahName}-${target.verseKey.replace(':', '-')}.jpg`
    document.body.appendChild(link)
    link.click()
    link.remove()
    setNotice('Saved to your downloads.')
  }, [target])

  if (!open || !mounted || !target) return null

  const selStart = range ? Math.min(range.start, range.end) : 0
  const selEnd = range ? Math.max(range.start, range.end) : pickerWords.length - 1
  const pickingSecondWord = Boolean(range && range.start === range.end)

  const sheet = (
    <div className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
      />

      <div
        role="dialog"
        data-share-sheet
        aria-label={`Share ayah ${target.verseKey}`}
        className="relative flex max-h-[94dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border-t text-[var(--mushaf-read-popup-text)] sm:rounded-3xl sm:border"
        style={{
          background: 'var(--mushaf-read-popup-bg)',
          borderColor: 'var(--mushaf-read-popup-border)',
        }}
      >
        <div className="flex shrink-0 items-center justify-between px-5 pb-1 pt-3.5">
          <div>
            <p className="text-sm font-semibold">Share this ayah</p>
            <p className="text-[11px] text-[var(--mushaf-popup-meta)]">
              {target.surahName} · {target.verseKey}
              {selection.partial ? ' · part' : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--mushaf-popup-badge-bg)] transition-transform active:scale-90"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-2">
          {/* Live preview */}
          <div className="flex items-center justify-center py-3">
            <div className="relative flex items-center justify-center">
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt={`Verse card for ${target.verseKey}`}
                  className={cn(
                    'max-h-[38dvh] w-auto rounded-xl shadow-[0_18px_40px_-16px_rgba(0,0,0,0.7)] transition-opacity duration-200',
                    rendering && 'opacity-60'
                  )}
                />
              ) : (
                <div className="flex h-[38dvh] w-[calc(38dvh*0.8)] items-center justify-center rounded-xl bg-[var(--mushaf-popup-badge-bg)]">
                  <Loader2 className="h-5 w-5 animate-spin text-[var(--mushaf-popup-meta)]" />
                </div>
              )}
              {rendering && previewUrl ? (
                <span className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-white/80" />
                </span>
              ) : null}
            </div>
          </div>

          {/* Word range */}
          {pickerWords.length > 1 ? (
            <div className="mb-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--mushaf-popup-meta)]">
                  {pickingSecondWord ? 'Now tap the last word' : 'Tap to share part of the ayah'}
                </p>
                {range ? (
                  <button
                    type="button"
                    onClick={() => setRange(null)}
                    className="flex items-center gap-1 text-[11px] font-semibold text-[var(--mushaf-read-accent)]"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Whole ayah
                  </button>
                ) : null}
              </div>
              <div
                dir="rtl"
                lang="ar"
                className="flex max-h-24 flex-wrap gap-1 overflow-y-auto rounded-xl bg-[var(--mushaf-popup-badge-bg)] p-2"
              >
                {pickerWords.map((word, i) => {
                  // Nothing is highlighted until a selection actually starts —
                  // highlighting every word by default just reads as noise.
                  const inRange = Boolean(range) && i >= selStart && i <= selEnd
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleWordTap(i)}
                      className={cn(
                        'arabic-text rounded-md px-1.5 py-0.5 text-[15px] leading-relaxed transition-colors',
                        inRange
                          ? 'bg-[var(--mushaf-read-accent)] text-white'
                          : range
                            ? 'text-[var(--mushaf-read-popup-text)] opacity-40'
                            : 'text-[var(--mushaf-read-popup-text)] opacity-80'
                      )}
                    >
                      {word}
                    </button>
                  )
                })}
              </div>
              {selection.partial ? (
                <p className="mt-1.5 text-[10px] text-[var(--mushaf-popup-meta)]">
                  Translation is left off when sharing part of an ayah.
                </p>
              ) : null}
            </div>
          ) : null}

          {/* Backgrounds */}
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--mushaf-popup-meta)]">
            Background
          </p>
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {VERSE_IMAGE_BACKGROUNDS.map((bg) => {
              const selected = bg.id === backgroundId
              return (
                <button
                  key={bg.id}
                  type="button"
                  onClick={() => setBackgroundId(bg.id)}
                  aria-label={bg.label}
                  aria-pressed={selected}
                  className={cn(
                    'relative h-12 w-12 shrink-0 overflow-hidden rounded-xl transition-transform active:scale-95',
                    selected
                      ? 'ring-2 ring-[var(--mushaf-read-accent)] ring-offset-2 ring-offset-[var(--mushaf-read-popup-bg)]'
                      : 'ring-1 ring-white/15'
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={bg.src} alt="" className="h-full w-full object-cover" loading="lazy" />
                  {selected ? (
                    <span className="absolute inset-0 flex items-center justify-center bg-black/35">
                      <Check className="h-4 w-4 text-white" strokeWidth={3} />
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>

          {translationLoading && !translation && !selection.partial ? (
            <p className="pt-2 text-[11px] text-[var(--mushaf-popup-meta)]">
              Loading the translation…
            </p>
          ) : null}
          {notice ? (
            <p className="pt-2 text-[11px] font-medium text-[var(--mushaf-read-accent)]">{notice}</p>
          ) : null}
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-2.5 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          <button
            type="button"
            onClick={handleDownload}
            disabled={!previewUrl || rendering}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--mushaf-popup-badge-bg)] transition-transform active:scale-95 disabled:opacity-50"
            aria-label="Save image"
          >
            <Download className="h-[18px] w-[18px]" />
          </button>
          <button
            type="button"
            onClick={() => void handleShare()}
            disabled={!previewUrl || rendering || busy}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-[var(--mushaf-read-accent)] text-sm font-semibold text-white transition-transform active:scale-[0.98] disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
            Share
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(sheet, document.body)
}
