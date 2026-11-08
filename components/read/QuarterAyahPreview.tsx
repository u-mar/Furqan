'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useQcfFont } from '@/hooks/useQcfFont'
import { qcfPageFontFamily } from '@/lib/qcf-page'
import { quarterOpening } from '@/lib/quarters'
import { cn } from '@/lib/cn'

/** Fonts start loading this far ahead of the scroll, so a row is ready when it arrives. */
const LOAD_AHEAD_PX = 1500

/** The panel a row scrolls in. A margin on the screen itself cannot reach past that panel's edge. */
function scrollPanel(el: HTMLElement): HTMLElement | null {
  for (let node = el.parentElement; node; node = node.parentElement) {
    if (/auto|scroll/.test(getComputedStyle(node).overflowY)) return node
  }
  return null
}

interface QuarterAyahPreviewProps {
  verseKey: string
  className?: string
}

/**
 * A quarter's opening ayah in the same QCF mushaf glyphs as the reader. The
 * words are built into the app and the fonts ship with it, so this works with
 * no connection. Nothing is drawn until the page's font is ready, so the
 * script never visibly changes; only if that font cannot be had is plain text
 * shown. Font loading is gated behind visibility: there are 240 of these, each
 * on a different page. The caller gives it one wrapping line's height, so only
 * whole words show and a row is the same height before and after its font.
 */
export default function QuarterAyahPreview({ verseKey, className }: QuarterAyahPreviewProps) {
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
    if (rect.bottom > -LOAD_AHEAD_PX && rect.top < window.innerHeight + LOAD_AHEAD_PX) {
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
      { root: scrollPanel(el), rootMargin: `${LOAD_AHEAD_PX}px` }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [visible])

  const opening = quarterOpening(verseKey)
  const page = opening?.p ?? 0
  const sample = opening?.g[0]?.replace(/\s/g, '').slice(0, 12) ?? ''
  const { ready, failed } = useQcfFont(page, visible && Boolean(opening), sample, true)

  if (opening && ready) {
    return (
      <p ref={rootRef} className={className} dir="rtl" lang="ar" style={{ fontFamily: qcfPageFontFamily(page) }}>
        {opening.g.map((word, i) => (
          <span key={i} className="mushaf-translation-qcf-word">
            {word}
          </span>
        ))}
      </p>
    )
  }

  // Unseen while its font loads.
  return (
    <p ref={rootRef} className={cn(className, !failed && opening && 'invisible')} dir="rtl" lang="ar">
      {opening?.t ?? '…'}
    </p>
  )
}
