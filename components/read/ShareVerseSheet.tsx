'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Download, LayoutGrid, Loader2, Minus, Plus, RotateCcw, Send, Share2, X } from 'lucide-react'
import BackgroundGallery from '@/components/share/BackgroundGallery'
import { askToSignIn } from '@/lib/account-prompt'
import { getSignedInUser } from '@/lib/auth'
import { cn } from '@/lib/cn'
import { postAyahCard } from '@/lib/qari-upload'
import {
  DEFAULT_BACKGROUND_ID,
  DEFAULT_VERSE_FONT_SCALE,
  MAX_VERSE_FONT_SCALE,
  MIN_VERSE_FONT_SCALE,
  VERSE_FONT_SCALE_STEP,
  VERSE_IMAGE_BACKGROUNDS,
  renderVerseImage,
  shareVerseBlob,
} from '@/lib/verse-image'
import { FEATURED_SHARE_BACKGROUND_IDS, SHARE_BACKGROUND_GROUPS } from '@/lib/share-backgrounds'
import { getWordTranslations } from '@/lib/word-translations'
import { toast } from '@/lib/toast'
import { tr, useT } from '@/lib/i18n'

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
  /** Language of the translation, e.g. "en". */
  translationLanguage: string
  /** The translation edition in use, e.g. "en.sahih" — a part is cut from this one. */
  translationEdition: string
  onClose: () => void
}

/** How a part's translation was found — said under the switch, so nobody mistakes a word list for the meaning. */
type PartSource = 'ai' | 'matched' | 'words'

const partCache = new Map<string, { text: string | null; source: PartSource | null }>()

/**
 * The translation of the chosen words: cut from the published translation of
 * the whole ayah on the server (see lib/part-translation.ts), or — with no
 * connection — the meanings of the words themselves.
 */
async function fetchPart(
  verseKey: string,
  edition: string,
  start: number,
  end: number,
  language: string
): Promise<{ text: string | null; source: PartSource | null }> {
  const key = `${edition}|${verseKey}|${start}|${end}`
  const known = partCache.get(key)
  if (known) return known
  try {
    const params = new URLSearchParams({ type: 'part-translation', verse: verseKey, edition, start: String(start), end: String(end) })
    const res = await fetch(`/api/ayah?${params.toString()}`)
    if (!res.ok) throw new Error('part translation failed')
    const data = (await res.json()) as { text?: string | null; source?: PartSource | null }
    const result = { text: data.text ?? null, source: data.source ?? null }
    if (result.source !== 'words') partCache.set(key, result)
    return result
  } catch {
    const glosses = await getWordTranslations(verseKey, language)
    const text = glosses?.slice(start, end + 1).filter(Boolean).join(' ') || null
    return { text, source: text ? 'words' : null }
  }
}

/**
 * Sharing an ayah as a picture, full screen: the card, every word of the ayah
 * with room to choose from (tap the first word, then the last), its
 * translation, size and background — then share, save, or post it to Qari.
 */
export default function ShareVerseSheet({
  open,
  target,
  translation,
  translationLoading,
  translationLanguage,
  translationEdition,
  onClose,
}: ShareVerseSheetProps) {
  const t = useT()
  const [mounted, setMounted] = useState(false)
  const [backgroundId, setBackgroundId] = useState(DEFAULT_BACKGROUND_ID)
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [range, setRange] = useState<{ start: number; end: number } | null>(null)
  /** The first word tapped, while waiting for the last. */
  const [anchor, setAnchor] = useState<number | null>(null)
  const [showTranslation, setShowTranslation] = useState(true)
  const [fontScale, setFontScale] = useState(DEFAULT_VERSE_FONT_SCALE)
  const [part, setPart] = useState<{ text: string | null; source: PartSource | null } | null>(null)
  const [partLoading, setPartLoading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [rendering, setRendering] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [postOpen, setPostOpen] = useState(false)
  const [postCaption, setPostCaption] = useState('')
  /** The picture Qari gets: the same card, drawn the shape of a phone screen. */
  const [postImage, setPostImage] = useState<{ blob: Blob; url: string } | null>(null)
  const previewUrlRef = useRef<string | null>(null)
  const blobRef = useRef<Blob | null>(null)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    // The page underneath stays put while this one scrolls.
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [open, onClose])

  /* A new ayah resets the selection, its translation, and the text size. */
  useEffect(() => {
    setRange(null)
    setAnchor(null)
    setPart(null)
    setFontScale(DEFAULT_VERSE_FONT_SCALE)
    setPostOpen(false)
    setPostCaption('')
  }, [target?.verseKey])

  const useQcf = Boolean(target?.qcfWords.length)
  /** Words shown in the picker are always readable Uthmani, even when the card draws glyphs. */
  const pickerWords = useMemo(() => target?.plainWords ?? [], [target])
  const sourceWords = useMemo(() => (useQcf ? target?.qcfWords ?? [] : pickerWords), [pickerWords, target, useQcf])

  const selection = useMemo(() => {
    const total = sourceWords.length
    if (!total) return { words: [] as string[], partial: false, start: 0, end: 0 }
    const start = range ? Math.min(range.start, range.end) : 0
    const end = range ? Math.max(range.start, range.end) : total - 1
    return {
      words: sourceWords.slice(start, end + 1),
      partial: start > 0 || end < total - 1,
      start,
      end,
    }
  }, [range, sourceWords])

  /* The meaning of the chosen words, asked for once the choice settles. */
  useEffect(() => {
    if (!open || !target || !selection.partial || !showTranslation) {
      setPartLoading(false)
      return
    }
    let cancelled = false
    setPartLoading(true)
    const timer = window.setTimeout(() => {
      void fetchPart(target.verseKey, translationEdition, selection.start, selection.end, translationLanguage).then((result) => {
        if (cancelled) return
        setPart(result)
        setPartLoading(false)
      })
    }, 300)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [open, target, selection.partial, selection.start, selection.end, showTranslation, translationEdition, translationLanguage])

  /** A whole ayah gets its translation; a part gets the part of it that says what those words say. */
  const cardTranslation = useMemo(() => {
    if (!showTranslation) return null
    if (!selection.partial) return translation
    return part?.text ?? null
  }, [showTranslation, selection.partial, translation, part])

  /* Render (and re-render) the card as background, range or translation change. */
  useEffect(() => {
    if (!open || !target || selection.words.length === 0) return
    // A part's translation is on its way: the card waits for it rather than drawing twice.
    if (partLoading) return
    let cancelled = false
    setRendering(true)

    void (async () => {
      try {
        const blob = await renderVerseImage({
          words: selection.words,
          page: target.page,
          isQcf: useQcf,
          translation: cardTranslation,
          surahName: target.surahName,
          verseKey: target.verseKey,
          partial: selection.partial,
          backgroundId,
          fontScale,
        })
        if (cancelled) return
        blobRef.current = blob
        const url = URL.createObjectURL(blob)
        if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
        previewUrlRef.current = url
        setPreviewUrl(url)
      } catch (err) {
        if (!cancelled) setNotice(err instanceof Error ? err.message : tr('Could not build the card.'))
      } finally {
        if (!cancelled) setRendering(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [open, target, backgroundId, selection, useQcf, cardTranslation, fontScale, partLoading])

  /* Drop the object URL when the page closes. */
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

  /**
   * Tap the first word, then the last. Tapping (rather than dragging) leaves a
   * finger free to scroll a long ayah to the word it wants.
   */
  const tapWord = useCallback(
    (index: number) => {
      if (anchor === null) {
        setRange({ start: index, end: index })
        setAnchor(index)
      } else {
        setRange({ start: Math.min(anchor, index), end: Math.max(anchor, index) })
        setAnchor(null)
      }
    },
    [anchor]
  )

  const wholeAyah = useCallback(() => {
    setRange(null)
    setAnchor(null)
  }, [])

  const changeFontScale = useCallback((delta: number) => {
    setFontScale((v) => {
      const next = Math.round((v + delta) * 10) / 10
      return Math.min(MAX_VERSE_FONT_SCALE, Math.max(MIN_VERSE_FONT_SCALE, next))
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
      else setNotice(tr('Saved to your downloads.'))
    } catch (err) {
      console.error('Share verse failed:', err)
      setNotice(err instanceof Error ? err.message : tr('Could not share the card.'))
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
    setNotice(tr('Saved to your downloads.'))
  }, [target])

  const openPost = useCallback(() => {
    if (!getSignedInUser()) {
      askToSignIn({ reason: tr('Create a free account to post to Qari.') })
      return
    }
    setPostOpen(true)
  }, [])

  /* While posting is open, the card is drawn again as a full phone screen for Qari. */
  useEffect(() => {
    if (!postOpen || !target || selection.words.length === 0) return
    let cancelled = false
    let made: string | null = null
    void renderVerseImage({
      words: selection.words,
      page: target.page,
      isQcf: useQcf,
      translation: cardTranslation,
      surahName: target.surahName,
      verseKey: target.verseKey,
      partial: selection.partial,
      backgroundId,
      fontScale,
      format: 'story',
    })
      .then((blob) => {
        if (cancelled) return
        made = URL.createObjectURL(blob)
        setPostImage({ blob, url: made })
      })
      .catch(() => {
        if (!cancelled) setNotice(tr('Could not build the card.'))
      })
    return () => {
      cancelled = true
      if (made) URL.revokeObjectURL(made)
      setPostImage(null)
    }
  }, [postOpen, target, selection, useQcf, cardTranslation, backgroundId, fontScale])

  /** Hands the card to Qari's uploads and returns to reading; the profile shows it going up. */
  const handlePost = useCallback(() => {
    const blob = postImage?.blob
    const user = getSignedInUser()
    if (!blob || !target || !user) return
    postAyahCard({
      image: blob,
      verseKey: target.verseKey,
      title: `${target.surahName} ${target.verseKey}`,
      caption: postCaption.trim(),
      hashtags: '',
      isPrivate: false,
      userId: user.id,
      userName: user.name,
      userUsername: user.username,
    })
    toast(tr('Posting to Qari…'))
    setPostOpen(false)
    setPostCaption('')
    onClose()
  }, [onClose, postCaption, postImage, target])

  if (!open || !mounted || !target) return null

  // A few to pick from at a glance; the one in use is always among them.
  const featured = VERSE_IMAGE_BACKGROUNDS.filter((bg) => FEATURED_SHARE_BACKGROUND_IDS.includes(bg.id))
  const chosen = VERSE_IMAGE_BACKGROUNDS.find((bg) => bg.id === backgroundId)
  const stripBackgrounds = chosen && !featured.includes(chosen) ? [chosen, ...featured] : featured

  const selStart = range ? Math.min(range.start, range.end) : 0
  const selEnd = range ? Math.max(range.start, range.end) : pickerWords.length - 1
  const ready = Boolean(previewUrl) && !rendering && !partLoading

  const partStatus = !selection.partial
    ? null
    : partLoading
      ? t('Finding what these words mean in this ayah…')
      : part?.source === 'ai' || part?.source === 'matched'
        ? t('From the full translation of the ayah')
        : part?.source === 'words'
          ? t('Word by word: the full meaning was not found')
          : t('No translation for part of this ayah')

  const page = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('Share ayah {verseKey}', { verseKey: target.verseKey })}
      className="fixed inset-0 z-[120] flex flex-col text-[var(--mushaf-read-popup-text)]"
      style={{ background: 'var(--mushaf-read-popup-bg)' }}
    >
      <header className="flex shrink-0 items-center gap-3 px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={onClose}
          aria-label={t('Close')}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--mushaf-popup-badge-bg)] transition-transform active:scale-90"
        >
          <X className="h-[18px] w-[18px]" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold">{t('Share this ayah')}</p>
          <p className="truncate text-xs text-[var(--mushaf-popup-meta)]">
            {target.surahName} · {target.verseKey}
            {selection.partial ? t(' · part') : ''}
          </p>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto w-full max-w-md px-4 pb-6">
          {/* Live preview */}
          <div className="flex items-center justify-center py-3">
            <div className="relative flex items-center justify-center">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt={t('Verse card for {verseKey}', { verseKey: target.verseKey })}
                  className={cn(
                    'max-h-[40dvh] w-auto rounded-2xl shadow-[0_18px_40px_-16px_rgba(0,0,0,0.7)] transition-opacity duration-200',
                    (rendering || partLoading) && 'opacity-60'
                  )}
                />
              ) : (
                <div className="flex h-[40dvh] w-[calc(40dvh*0.8)] items-center justify-center rounded-2xl bg-[var(--mushaf-popup-badge-bg)]">
                  <Loader2 className="h-5 w-5 animate-spin text-[var(--mushaf-popup-meta)]" />
                </div>
              )}
              {(rendering || partLoading) && previewUrl ? (
                <span className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-white/80" />
                </span>
              ) : null}
            </div>
          </div>

          {/* The words to choose from — all of them, in a page that scrolls. */}
          {pickerWords.length > 1 ? (
            <section className="mt-1">
              <div className="mb-2 flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold">{t('Share part of the ayah')}</p>
                  <p className="text-xs text-[var(--mushaf-popup-meta)]" aria-live="polite">
                    {anchor !== null
                      ? t('Now tap the last word')
                      : range
                        ? t('{selEnd} of {length} words', { selEnd: selEnd - selStart + 1, length: pickerWords.length })
                        : t('Tap the first word, then the last')}
                  </p>
                </div>
                {range ? (
                  <button
                    type="button"
                    onClick={wholeAyah}
                    className="flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-[var(--mushaf-popup-badge-bg)] px-3 text-xs font-semibold text-[var(--mushaf-read-accent)]"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    {t('Whole ayah')}
                  </button>
                ) : null}
              </div>
              <div
                dir="rtl"
                lang="ar"
                className="flex flex-wrap gap-x-1.5 gap-y-2 rounded-2xl bg-[var(--mushaf-popup-badge-bg)] p-3"
              >
                {pickerWords.map((word, i) => {
                  // Nothing is highlighted until a choice starts — every word lit just reads as noise.
                  const inRange = Boolean(range) && i >= selStart && i <= selEnd
                  const isAnchor = anchor === i
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => tapWord(i)}
                      aria-pressed={inRange}
                      className={cn(
                        'arabic-text rounded-lg px-2 py-1 text-[20px] leading-[1.9] transition-colors',
                        inRange
                          ? 'bg-[var(--mushaf-read-accent)] text-white'
                          : range
                            ? 'opacity-45'
                            : 'opacity-90 hover:bg-black/5',
                        isAnchor && 'ring-2 ring-[var(--mushaf-read-accent)] ring-offset-2 ring-offset-[var(--mushaf-popup-badge-bg)]'
                      )}
                    >
                      {word}
                    </button>
                  )
                })}
              </div>
            </section>
          ) : null}

          {/* Translation */}
          {translation ? (
            <section className="mt-4 rounded-2xl bg-[var(--mushaf-popup-badge-bg)] px-3.5 py-3">
              <button
                type="button"
                onClick={() => setShowTranslation((v) => !v)}
                role="switch"
                aria-checked={showTranslation}
                className="flex w-full items-center justify-between gap-3 text-left"
              >
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold">{t('Include translation')}</span>
                  {showTranslation && partStatus ? (
                    <span className="mt-0.5 flex items-center gap-1.5 text-xs text-[var(--mushaf-popup-meta)]">
                      {partLoading ? <Loader2 className="h-3 w-3 shrink-0 animate-spin" /> : null}
                      {partStatus}
                    </span>
                  ) : null}
                </span>
                <span
                  className={cn(
                    'relative h-6 w-10 shrink-0 rounded-full transition-colors',
                    showTranslation ? 'bg-[var(--mushaf-read-accent)]' : 'bg-black/20'
                  )}
                  aria-hidden
                >
                  <span
                    className={cn(
                      'absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform',
                      showTranslation ? 'translate-x-[1.15rem]' : 'translate-x-0.5'
                    )}
                  />
                </span>
              </button>
              {showTranslation && cardTranslation && !partLoading ? (
                <p className="mt-2.5 border-t border-[var(--mushaf-read-popup-border)] pt-2.5 text-[13.5px] leading-relaxed">
                  {cardTranslation}
                </p>
              ) : null}
            </section>
          ) : null}

          {/* Text size */}
          <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-[var(--mushaf-popup-badge-bg)] px-3.5 py-2.5">
            <span className="text-[13px] font-semibold">{t('Ayah text size')}</span>
            <div className="flex items-center gap-0.5 rounded-full border border-[var(--mushaf-read-popup-border)] px-1">
              <button
                type="button"
                onClick={() => changeFontScale(-VERSE_FONT_SCALE_STEP)}
                disabled={fontScale <= MIN_VERSE_FONT_SCALE}
                aria-label={t('Smaller text')}
                className="ed-focus flex h-8 w-8 items-center justify-center rounded-full disabled:opacity-30"
              >
                <Minus className="h-3.5 w-3.5" strokeWidth={2.4} />
              </button>
              <span className="w-10 text-center text-[0.8125rem] font-semibold tabular-nums">
                {Math.round((fontScale / DEFAULT_VERSE_FONT_SCALE) * 100)}%
              </span>
              <button
                type="button"
                onClick={() => changeFontScale(VERSE_FONT_SCALE_STEP)}
                disabled={fontScale >= MAX_VERSE_FONT_SCALE}
                aria-label={t('Bigger text')}
                className="ed-focus flex h-8 w-8 items-center justify-center rounded-full disabled:opacity-30"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={2.4} />
              </button>
            </div>
          </div>

          {/* Backgrounds */}
          <p className="mb-2 mt-4 text-[13px] font-semibold">{t('Background')}</p>
          <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1">
            {stripBackgrounds.map((bg) => {
              const selected = bg.id === backgroundId
              return (
                <button
                  key={bg.id}
                  type="button"
                  onClick={() => setBackgroundId(bg.id)}
                  aria-label={t(bg.label)}
                  aria-pressed={selected}
                  className={cn(
                    'relative h-14 w-14 shrink-0 overflow-hidden rounded-xl transition-transform active:scale-95',
                    selected
                      ? 'ring-2 ring-[var(--mushaf-read-accent)] ring-offset-2 ring-offset-[var(--mushaf-read-popup-bg)]'
                      : 'ring-1 ring-black/10'
                  )}
                >
                  <img src={bg.thumb} alt="" className="h-full w-full object-cover" loading="lazy" />
                  {selected ? (
                    <span className="absolute inset-0 flex items-center justify-center bg-black/35">
                      <Check className="h-4 w-4 text-white" strokeWidth={3} />
                    </span>
                  ) : null}
                </button>
              )
            })}
            <button
              type="button"
              onClick={() => setGalleryOpen(true)}
              className="flex h-14 shrink-0 items-center gap-1.5 rounded-xl bg-[var(--mushaf-popup-badge-bg)] px-3.5 text-xs font-semibold transition-transform active:scale-95"
            >
              <LayoutGrid className="h-4 w-4" strokeWidth={2} />
              {t('More')}
            </button>
          </div>

          {translationLoading && !translation ? (
            <p className="pt-3 text-xs text-[var(--mushaf-popup-meta)]">{t('Loading the translation…')}</p>
          ) : null}
          {notice ? <p className="pt-3 text-xs font-medium text-[var(--mushaf-read-accent)]">{notice}</p> : null}
        </div>
      </div>

      {/* Actions */}
      <div
        className="shrink-0 border-t px-4 pb-[max(0.875rem,env(safe-area-inset-bottom))] pt-3"
        style={{ borderColor: 'var(--mushaf-read-popup-border)' }}
      >
        <div className="mx-auto flex w-full max-w-md items-center gap-2.5">
          <button
            type="button"
            onClick={handleDownload}
            disabled={!ready}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--mushaf-popup-badge-bg)] transition-transform active:scale-95 disabled:opacity-50"
            aria-label={t('Save image')}
          >
            <Download className="h-[18px] w-[18px]" />
          </button>
          <button
            type="button"
            onClick={openPost}
            disabled={!ready}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full border text-sm font-semibold transition-transform active:scale-[0.98] disabled:opacity-50"
            style={{ borderColor: 'var(--mushaf-read-popup-border)' }}
          >
            <Send className="h-4 w-4" />
            {t('Post to Qari')}
          </button>
          <button
            type="button"
            onClick={() => void handleShare()}
            disabled={!ready || busy}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-[var(--mushaf-read-accent)] text-sm font-semibold text-white transition-transform active:scale-[0.98] disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
            {t('Share')}
          </button>
        </div>
      </div>

      {/* Posting to Qari: a word to go with it, then it goes up from the profile. */}
      {postOpen ? (
        <div className="absolute inset-0 z-10 flex items-end justify-center bg-black/50" onClick={() => setPostOpen(false)}>
          <div
            className="w-full max-w-md rounded-t-[1.75rem] px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4"
            style={{ background: 'var(--mushaf-read-popup-bg)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex gap-3.5">
              <span className="relative flex aspect-[9/16] w-[4.25rem] shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[var(--mushaf-popup-badge-bg)]">
                {postImage ? (
                  <img src={postImage.url} alt="" className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <Loader2 className="h-4 w-4 animate-spin text-[var(--mushaf-popup-meta)]" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold">{t('Post to Qari')}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-[var(--mushaf-popup-meta)]">
                  {t('It fills the screen in the Qari swipe view, and shows on your profile.')}
                </p>
              </div>
            </div>
            <label className="mt-3.5 block">
              <span className="sr-only">{t('Note')}</span>
              <textarea
                value={postCaption}
                onChange={(e) => setPostCaption(e.target.value.slice(0, 280))}
                rows={3}
                placeholder={t('Add a note (optional)')}
                className="w-full resize-none rounded-2xl bg-[var(--mushaf-popup-badge-bg)] px-3.5 py-3 text-[14.5px] leading-relaxed outline-none placeholder:text-[var(--mushaf-popup-meta)]"
              />
            </label>
            <div className="mt-3 flex gap-2.5">
              <button
                type="button"
                onClick={() => setPostOpen(false)}
                className="h-12 flex-1 rounded-full border text-sm font-semibold"
                style={{ borderColor: 'var(--mushaf-read-popup-border)' }}
              >
                {t('Cancel')}
              </button>
              <button
                type="button"
                onClick={handlePost}
                disabled={!postImage}
                className="flex h-12 flex-[1.4] items-center justify-center gap-2 rounded-full bg-[var(--mushaf-read-accent)] text-sm font-semibold text-white disabled:opacity-60"
              >
                <Send className="h-4 w-4" />
                {t('Post')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )

  return createPortal(
    <>
      {page}
      <BackgroundGallery
        open={galleryOpen}
        items={VERSE_IMAGE_BACKGROUNDS}
        groups={SHARE_BACKGROUND_GROUPS}
        selectedId={backgroundId}
        onSelect={setBackgroundId}
        onClose={() => setGalleryOpen(false)}
      />
    </>,
    document.body
  )
}
