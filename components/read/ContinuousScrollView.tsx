'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { loadPageFont } from '@/lib/mushaf-fonts'
import { pageHasQcfData, qcfPageSampleGlyphs } from '@/lib/qcf-page'
import type { Verse } from '@/types'

/** Pages kept loaded on each side of the one showing. */
const WINDOW_RADIUS = 2
/** Pages this far from the current one are dropped to bound memory. */
const PRUNE_RADIUS = 6
/** Fine-grained so the observer reports on every meaningful scroll step —
 *  a single [0.5] threshold only fires when a target's own ratio crosses
 *  0.5, which a page taller than the viewport may never do. */
const DENSE_THRESHOLDS = Array.from({ length: 21 }, (_, i) => i / 20)
/** Seed estimate for pages not yet measured — close to a typical rendered
 *  page's height, refined from real measurements as they come in. */
const DEFAULT_PAGE_HEIGHT = 1250

export interface ContinuousScrollViewProps {
  currentPage: number
  totalPages: number
  fetchPage: (page: number) => Promise<Verse[]>
  renderPage: (verses: Verse[], page: number) => ReactNode
  /** Fired when scrolling makes a different page the one showing. */
  onPageChange: (page: number) => void
}

/**
 * Every mushaf page keeps its own fixed, printed-page layout — the same "fit"
 * sizing the swipe views use — this just stacks pages in an ordinary
 * scrollable column instead of a carousel, so moving between them is native
 * momentum scrolling rather than a drag-and-commit page-turn. Only pages near
 * the one showing are kept mounted; the rest are freed as you move on.
 *
 * Only ~5 pages are ever in the DOM at once, so above/below the loaded
 * window sit plain spacer divs sized from the running average page height —
 * without them, the scrollable area's height would only ever reflect the
 * handful of mounted pages, and the native scrollbar would visibly reset
 * every time the window shifted. The spacers keep it representing progress
 * through the whole book.
 *
 * Pages load in (and get pruned out) asynchronously, and some of that always
 * lands *above* whatever's on screen — the browser has no idea that's what
 * happened, so it leaves `scrollTop` at the same pixel offset, which now
 * points at different content than a moment ago. This is the standard
 * "scroll anchoring" problem virtualized lists have; the layout effect below
 * measures the total height above the page currently showing (spacer +
 * mounted pages before it) and nudges `scrollTop` by however much that
 * changed since its last measurement, so nothing visibly moves.
 */
export default function ContinuousScrollView({
  currentPage,
  totalPages,
  fetchPage,
  renderPage,
  onPageChange,
}: ContinuousScrollViewProps) {
  // The source of truth lives in refs, not state — state only forces a
  // re-render once data actually changes, so the fetch/prune logic below
  // never has to worry about a stale closure over `pages`.
  const dataRef = useRef<Map<number, Verse[]>>(new Map())
  const loadingRef = useRef<Set<number>>(new Set())
  const [version, setVersion] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const pageEls = useRef<Map<number, HTMLDivElement>>(new Map())
  const heightCache = useRef<Map<number, number>>(new Map())
  const avgHeight = useRef(DEFAULT_PAGE_HEIGHT)
  // Height above `lastReported`'s page as of the last measurement; null means
  // "just changed anchor or just landed a jump — record a fresh baseline
  // instead of diffing against a number that described a different anchor."
  const aboveAnchorHeight = useRef<number | null>(null)
  const lastReported = useRef(currentPage)
  // `containerRef.current.scrollTop` at the moment `lastReported` was last
  // confirmed correct — the fling safety-net below estimates a page as an
  // offset from this known-good pair rather than from absolute zero, so a
  // transient blip in the spacer math elsewhere can't throw its guess wildly
  // off; it can only ever be as wrong as the scrolling *since* the last fix.
  const anchorScrollTop = useRef(0)
  const pendingJump = useRef<number | null>(currentPage)
  const loadDebounceRef = useRef<number | null>(null)

  const ensureLoaded = useCallback(
    (center: number) => {
      const from = Math.max(1, center - WINDOW_RADIUS)
      const to = Math.min(totalPages, center + WINDOW_RADIUS)
      let pruned = false
      for (const key of [...dataRef.current.keys()]) {
        if (Math.abs(key - center) > PRUNE_RADIUS) {
          dataRef.current.delete(key)
          pruned = true
        }
      }
      if (pruned) setVersion((n) => n + 1)
      for (let p = from; p <= to; p += 1) {
        if (dataRef.current.has(p) || loadingRef.current.has(p)) continue
        loadingRef.current.add(p)
        void fetchPage(p)
          .then((verses) => {
            loadingRef.current.delete(p)
            dataRef.current.set(p, verses)
            setVersion((n) => n + 1)
            // Kick the page's own glyph font off in parallel with mounting it —
            // otherwise each of the ~5 pages in the window independently starts
            // its font fetch only once React renders it, and the reader sees a
            // "Loading mushaf font…" flash per page, staggered across several
            // seconds. Started here, most are already loaded (or well underway)
            // by the time the page actually renders.
            if (pageHasQcfData(verses)) {
              void loadPageFont(p, qcfPageSampleGlyphs(verses, p))
            }
          })
          .catch(() => {
            loadingRef.current.delete(p)
          })
      }
    },
    [fetchPage, totalPages]
  )

  // First mount, and whenever `currentPage` changes for a reason other than
  // this view's own scroll (search, the slider, a surah jump, next/prev).
  useEffect(() => {
    ensureLoaded(currentPage)
    if (currentPage !== lastReported.current) {
      pendingJump.current = currentPage
    }
  }, [currentPage, ensureLoaded])

  // Runs synchronously after DOM mutations, before paint — waiting until a
  // jump's target page has actually mounted before scrolling to it. A plain
  // (post-paint) effect would let the browser flash the empty top spacer at
  // scrollTop 0 for a frame first.
  useLayoutEffect(() => {
    if (pendingJump.current === null) return
    const target = pendingJump.current
    const el = pageEls.current.get(target)
    if (!el) return
    el.scrollIntoView({ block: 'start' })
    lastReported.current = target
    pendingJump.current = null
    aboveAnchorHeight.current = null
    anchorScrollTop.current = containerRef.current?.scrollTop ?? 0
  })

  // Scroll-anchor compensation — see the component doc comment. Skipped
  // while a jump is pending: the target's own scrollIntoView (above)
  // supersedes it, and the "anchor" is still the old page until that lands.
  useLayoutEffect(() => {
    for (const [page, el] of pageEls.current) heightCache.current.set(page, el.offsetHeight)
    // A page still showing its one-line "Loading mushaf font…" placeholder
    // (or the font-check step in between) reports a real but tiny height —
    // averaging those in collapses the estimate toward zero, which then
    // corrupts the spacer sizing and the fling safety-net's page guess.
    // A real rendered mushaf page is always well above this floor.
    const measured = [...heightCache.current.values()].filter((h) => h > 400)
    if (measured.length) {
      const avg = measured.reduce((sum, h) => sum + h, 0) / measured.length
      // A hard floor/ceiling around the range real pages actually render at —
      // belt-and-braces against any one bad sample still swinging the
      // estimate far enough to throw off the fling safety-net's page guess.
      avgHeight.current = Math.min(2400, Math.max(700, avg))
    }

    if (pendingJump.current !== null) return

    const anchor = lastReported.current
    const orderedPages = [...dataRef.current.keys()].sort((a, b) => a - b)
    const topSpacerCount = Math.max(0, (orderedPages[0] ?? anchor) - 1)
    let aboveAnchor = topSpacerCount * avgHeight.current
    for (const page of orderedPages) {
      if (page >= anchor) break
      aboveAnchor += heightCache.current.get(page) ?? avgHeight.current
    }

    if (aboveAnchorHeight.current !== null && containerRef.current) {
      const delta = aboveAnchor - aboveAnchorHeight.current
      if (Math.abs(delta) > 0.5) containerRef.current.scrollTop += delta
    }
    aboveAnchorHeight.current = aboveAnchor
  }, [version])

  useEffect(() => {
    const root = containerRef.current
    if (!root) return
    const observer = new IntersectionObserver(
      (entries) => {
        // Compare visible *pixels*, not each page's own intersection ratio —
        // every mushaf page is taller than the viewport, so its ratio (visible
        // ÷ its own full height) tops out well under 0.5 and a coarse
        // threshold like [0.5] would simply never fire while scrolling.
        let best: { page: number; visiblePx: number } | null = null
        for (const entry of entries) {
          const page = Number((entry.target as HTMLElement).dataset.page)
          if (!page || !entry.isIntersecting) continue
          const visiblePx = entry.intersectionRect.height
          if (!best || visiblePx > best.visiblePx) best = { page, visiblePx }
        }
        if (best && best.page !== lastReported.current && pendingJump.current === null) {
          lastReported.current = best.page
          // The anchor itself just changed, so "height above it" means
          // something different than it did a moment ago — record a fresh
          // baseline next layout pass instead of diffing against the old
          // anchor's number.
          aboveAnchorHeight.current = null
          anchorScrollTop.current = root.scrollTop
          onPageChange(best.page)
          // A fast fling on a phone can cross a dozen+ pages in one motion,
          // firing this callback for every one of them — without debouncing,
          // each intermediate page would kick off its own burst of fetches
          // (loadPage ± WINDOW_RADIUS) that's obsolete before it even
          // resolves. Only the page the scroll actually settles on needs its
          // neighbours loaded.
          if (loadDebounceRef.current !== null) window.clearTimeout(loadDebounceRef.current)
          loadDebounceRef.current = window.setTimeout(() => {
            loadDebounceRef.current = null
            ensureLoaded(best.page)
          }, 150)
        }
      },
      { root, threshold: DENSE_THRESHOLDS }
    )
    for (const el of pageEls.current.values()) observer.observe(el)
    return () => {
      observer.disconnect()
      if (loadDebounceRef.current !== null) window.clearTimeout(loadDebounceRef.current)
    }
  }, [ensureLoaded, onPageChange, version])

  // Safety net for a fast fling that jumps clean over the whole loaded
  // window in one motion, landing on a bare spacer with no observed element
  // anywhere near it — the IntersectionObserver above has nothing to report
  // in that case, so nothing would otherwise ever load for where the user
  // actually lands. Estimate the page from the raw scroll position instead.
  useEffect(() => {
    const root = containerRef.current
    if (!root) return
    let debounce: number | null = null
    const onScroll = () => {
      if (debounce !== null) window.clearTimeout(debounce)
      debounce = window.setTimeout(() => {
        debounce = null
        // Relative to the last confirmed-correct (page, scrollTop) pair, not
        // absolute position from zero — immune to a transient blip in the
        // spacer math anywhere else in the document.
        const pagesMoved = Math.round((root.scrollTop - anchorScrollTop.current) / avgHeight.current)
        const approx = Math.min(totalPages, Math.max(1, lastReported.current + pagesMoved))
        console.log('[dbg2] fallback', { scrollTop: root.scrollTop, anchor: anchorScrollTop.current, avg: avgHeight.current, lastReported: lastReported.current, pagesMoved, approx, has: dataRef.current.has(approx) })
        if (!dataRef.current.has(approx) && !loadingRef.current.has(approx)) {
          ensureLoaded(approx)
        }
      }, 200)
    }
    root.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      root.removeEventListener('scroll', onScroll)
      if (debounce !== null) window.clearTimeout(debounce)
    }
  }, [ensureLoaded, totalPages])

  const orderedPages = [...dataRef.current.keys()].sort((a, b) => a - b)
  const firstLoaded = orderedPages[0] ?? currentPage
  const lastLoaded = orderedPages[orderedPages.length - 1] ?? currentPage
  const topSpacerHeight = Math.max(0, firstLoaded - 1) * avgHeight.current
  const bottomSpacerHeight = Math.max(0, totalPages - lastLoaded) * avgHeight.current

  return (
    <div ref={containerRef} className="h-full overflow-y-auto overscroll-contain">
      {topSpacerHeight > 0 && <div style={{ height: topSpacerHeight }} aria-hidden />}
      {orderedPages.map((page) => (
        <div
          key={page}
          ref={(el) => {
            if (el) pageEls.current.set(page, el)
            else pageEls.current.delete(page)
          }}
          data-page={page}
        >
          {renderPage(dataRef.current.get(page) as Verse[], page)}
        </div>
      ))}
      {bottomSpacerHeight > 0 && <div style={{ height: bottomSpacerHeight }} aria-hidden />}
    </div>
  )
}
