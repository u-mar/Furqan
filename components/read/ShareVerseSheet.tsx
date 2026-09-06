'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Download, Loader2, Share2, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import {
  VERSE_IMAGE_THEMES,
  renderVerseImage,
  shareVerseBlob,
  type VerseImageThemeId,
} from '@/lib/verse-image'

export interface ShareVerseTarget {
  arabic: string
  surahName: string
  verseKey: string
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
  const [themeId, setThemeId] = useState<VerseImageThemeId>('midnight')
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

  /* Render (and re-render) the card as the theme or translation changes. */
  useEffect(() => {
    if (!open || !target) return
    let cancelled = false
    setRendering(true)

    void (async () => {
      try {
        const blob = await renderVerseImage({
          arabic: target.arabic,
          translation,
          surahName: target.surahName,
          verseKey: target.verseKey,
          themeId,
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
  }, [open, target, translation, themeId])

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
    link.download = `${target.surahName}-${target.verseKey.replace(':', '-')}.png`
    document.body.appendChild(link)
    link.click()
    link.remove()
    setNotice('Saved to your downloads.')
  }, [target])

  if (!open || !mounted || !target) return null

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
        aria-label={`Share ayah ${target.verseKey}`}
        className="relative flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border-t text-[var(--mushaf-read-popup-text)] sm:rounded-3xl sm:border"
        style={{
          background: 'var(--mushaf-read-popup-bg)',
          borderColor: 'var(--mushaf-read-popup-border)',
        }}
      >
        <div className="flex items-center justify-between px-5 pb-1 pt-3.5">
          <div>
            <p className="text-sm font-semibold">Share this ayah</p>
            <p className="text-[11px] text-[var(--mushaf-popup-meta)]">
              {target.surahName} · {target.verseKey}
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

        {/* Live preview */}
        <div className="flex min-h-0 flex-1 items-center justify-center px-5 py-3">
          <div className="relative flex max-h-[46dvh] items-center justify-center">
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt={`Verse card for ${target.verseKey}`}
                className={cn(
                  'max-h-[46dvh] w-auto rounded-xl shadow-[0_18px_40px_-16px_rgba(0,0,0,0.7)] transition-opacity duration-200',
                  rendering && 'opacity-60'
                )}
              />
            ) : (
              <div className="flex h-[46dvh] w-[calc(46dvh*0.8)] items-center justify-center rounded-xl bg-[var(--mushaf-popup-badge-bg)]">
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

        {/* Backgrounds */}
        <div className="px-5">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--mushaf-popup-meta)]">
            Background
          </p>
          <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
            {VERSE_IMAGE_THEMES.map((theme) => {
              const selected = theme.id === themeId
              return (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => setThemeId(theme.id)}
                  aria-label={theme.label}
                  aria-pressed={selected}
                  className={cn(
                    'relative h-11 w-11 shrink-0 rounded-xl transition-transform active:scale-95',
                    selected
                      ? 'ring-2 ring-[var(--mushaf-read-accent)] ring-offset-2 ring-offset-[var(--mushaf-read-popup-bg)]'
                      : 'ring-1 ring-white/15'
                  )}
                  style={{
                    background: `linear-gradient(160deg, ${theme.gradient.join(', ')})`,
                  }}
                >
                  {selected ? (
                    <Check
                      className="absolute inset-0 m-auto h-4 w-4 text-white drop-shadow"
                      strokeWidth={3}
                    />
                  ) : null}
                </button>
              )
            })}
          </div>
        </div>

        {translationLoading && !translation ? (
          <p className="px-5 pt-2 text-[11px] text-[var(--mushaf-popup-meta)]">
            Loading the translation…
          </p>
        ) : null}
        {notice ? (
          <p className="px-5 pt-2 text-[11px] font-medium text-[var(--mushaf-read-accent)]">
            {notice}
          </p>
        ) : null}

        {/* Actions */}
        <div className="flex items-center gap-2.5 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
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
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Share2 className="h-4 w-4" />
            )}
            Share
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(sheet, document.body)
}
