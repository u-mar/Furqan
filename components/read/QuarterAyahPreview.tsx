'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useQcfFont } from '@/hooks/useQcfFont'
import { getVerseArabicText } from '@/lib/quran-display'
import {
  getVerseQcfGlyphWords,
  pageHasQcfData,
  qcfPageFontFamily,
  qcfPageSampleGlyphs,
  versePageNumber,
} from '@/lib/qcf-page'
import type { Verse } from '@/types'

interface QuarterAyahPreviewProps {
  verse: Verse
  className?: string
}

/**
 * Renders a quarter's opening ayah with the same QCF mushaf glyphs used in the
 * main reader, instead of a plain Amiri/Uthmani fallback — falls back
 * automatically if the page's glyph font can't be loaded. Font loading is
 * gated behind visibility: the quarters list can mount 200+ of these at
 * once, and each quarter can land on a different page, so loading every
 * page's glyph font up front would fetch/parse hundreds of fonts at once.
 */
export default function QuarterAyahPreview({ verse, className }: QuarterAyahPreviewProps) {
  const rootRef = useRef<HTMLParagraphElement | null>(null)
  const [visible, setVisible] = useState(false)

  // Resolve items already on-screen at mount synchronously via layout, rather
  // than waiting on an IntersectionObserver callback (which some environments
  // defer while the tab/pane isn't actively compositing).
  useLayoutEffect(() => {
    if (visible) return
    const el = rootRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    if (rect.bottom > -300 && rect.top < window.innerHeight + 300) {
      setVisible(true)
    }
  }, [visible])

  useEffect(() => {
    if (visible) return
    const el = rootRef.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: '300px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [visible])

  const page = versePageNumber(verse)
  const hasQcf = visible && page > 0 && pageHasQcfData([verse])
  const qcfWords = useMemo(
    () => (hasQcf ? getVerseQcfGlyphWords(verse, page) : []),
    [hasQcf, verse, page]
  )
  const qcfSample = useMemo(
    () => (hasQcf ? qcfPageSampleGlyphs([verse], page) : ''),
    [hasQcf, verse, page]
  )
  const { ready } = useQcfFont(page, hasQcf && qcfWords.length > 0, qcfSample)
  const useGlyphs = hasQcf && ready && qcfWords.length > 0

  if (useGlyphs) {
    return (
      <p
        ref={rootRef}
        className={className}
        dir="rtl"
        lang="ar"
        style={{ fontFamily: qcfPageFontFamily(page) }}
      >
        {qcfWords.map((word, i) => (
          <span key={i} className="mushaf-translation-qcf-word">
            {word}
          </span>
        ))}
      </p>
    )
  }

  return (
    <p ref={rootRef} className={className} dir="rtl" lang="ar">
      {getVerseArabicText(verse, { omitEndMark: true }) || '…'}
    </p>
  )
}
