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
/** How far a pinch can shrink or enlarge the script, and where it is remembered. */
const MIN_SCALE = 0.7
const MAX_SCALE = 2.2
const SCALE_KEY = 'mushaf_flow_scale'

function readSavedScale(): number {
  try {
    const saved = parseFloat(localStorage.getItem(SCALE_KEY) ?? '')
    return Number.isFinite(saved) ? Math.min(MAX_SCALE, Math.max(MIN_SCALE, saved)) : 1
  } catch {
    return 1
  }
}

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
  /** The ayah being recited, while something plays: the view scrolls to keep it on screen. */
  followVerseKey?: string | null
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
 * Pages load in (and get pruned out) asynchronously, spacers are resized as
 * the average page height is learnt, and a page grows when its glyph font
 * arrives — much of that always lands *above* whatever's on screen, and the
 * browser leaves `scrollTop` at the same pixel offset, which then points at
 * different content (after a long jump, at nothing but spacer: an empty
 * screen). This is the standard "scroll anchoring" problem virtualized lists
 * have. The page being read is the anchor: where it sits in the scrolling
 * content is measured from the DOM itself, and whenever the content above it
 * changes size (watched by a ResizeObserver, so font loads and pinch-zoom count
 * too), `scrollTop` moves by exactly as much, so nothing visibly moves.
 * Page heights are kept as they would be unzoomed and the spacers sized from
 * them times the zoom in CSS, so a pinch resizes spacers and pages together.
 */
export default function ContinuousScrollView({
  currentPage,
  totalPages,
  fetchPage,
  renderPage,
  onPageChange,
  followVerseKey = null,
}: ContinuousScrollViewProps) {
  // The source of truth lives in refs, not state — state only forces a
  // re-render once data actually changes, so the fetch/prune logic below
  // never has to worry about a stale closure over `pages`.
  const dataRef = useRef<Map<number, Verse[]>>(new Map())
  const loadingRef = useRef<Set<number>>(new Set())
  const [version, setVersion] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const pageEls = useRef<Map<number, HTMLDivElement>>(new Map())
  // Page heights as they would be unzoomed (measured height ÷ zoom), so a pinch
  // never makes them stale: the spacers are sized from them times the zoom in
  // CSS, and so grow and shrink in the very same frame as the pages do.
  const heightCache = useRef<Map<number, number>>(new Map())
  const avgHeight = useRef(DEFAULT_PAGE_HEIGHT)
  // Where the page being read (`lastReported`) began in the scrolling content
  // when last measured. null means "just changed anchor or just landed a jump
  // — take a fresh measurement instead of comparing with another page's."
  const anchor = useRef<{ page: number; top: number } | null>(null)
  // The scroll position as last seen (after the reader scrolled, or after this
  // view set it), for telling when the browser has pulled it back on its own.
  const lastScrollTop = useRef(0)
  const contentRef = useRef<HTMLDivElement>(null)
  const lastReported = useRef(currentPage)
  // `containerRef.current.scrollTop` at the moment `lastReported` was last
  // confirmed correct — the fling safety-net below estimates a page as an
  // offset from this known-good pair rather than from absolute zero, so a
  // transient blip in the spacer math elsewhere can't throw its guess wildly
  // off; it can only ever be as wrong as the scrolling *since* the last fix.
  const anchorScrollTop = useRef(0)
  const pendingJump = useRef<number | null>(currentPage)
  const loadDebounceRef = useRef<number | null>(null)
  // Scrolling to follow the voice must not count as the reader moving to another page.
  const followingUntil = useRef(0)
  const scaleRef = useRef(1)
  const scaleSaveRef = useRef<number | null>(null)

  /** The top of a mounted page in content coordinates: unaffected by scrolling, moved only by what is above it. */
  const contentTop = useCallback((page: number): number | null => {
    const root = containerRef.current
    const el = pageEls.current.get(page)
    if (!root || !el) return null
    return el.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop
  }, [])

  /** Takes `page`, where it is now, as the place to keep. */
  const markAnchor = useCallback(
    (page: number) => {
      const top = contentTop(page)
      anchor.current = top === null ? null : { page, top }
      if (containerRef.current) lastScrollTop.current = containerRef.current.scrollTop
    },
    [contentTop]
  )

  /**
   * Keeps the page being read still on screen through any change in height
   * above it: whatever it moved by in the content, the scroll moves by too.
   *
   * When the list gets shorter all at once (spacers re-sized after a pinch),
   * the browser may first pull the scroll back to the new end on its own. That
   * is undone here by starting from where the scroll was, not where the browser
   * left it — otherwise the page would land that much below the screen.
   */
  const holdAnchor = useCallback(() => {
    const root = containerRef.current
    if (!root || pendingJump.current !== null) return
    const page = lastReported.current
    const top = contentTop(page)
    if (top === null) return
    if (anchor.current && anchor.current.page === page) {
      const delta = top - anchor.current.top
      const end = root.scrollHeight - root.clientHeight
      const pulledBack = root.scrollTop >= end - 1 && lastScrollTop.current > root.scrollTop + 1
      const from = pulledBack ? lastScrollTop.current : root.scrollTop
      if (Math.abs(delta) > 0.5 || pulledBack) {
        root.scrollTop = from + delta
        anchorScrollTop.current += root.scrollTop - from
      }
    }
    markAnchor(page)
  }, [contentTop, markAnchor])

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
            // loading-skeleton flash per page, staggered across several
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
    const root = containerRef.current
    if (!el || !root) return
    // Not scrollIntoView: that also scrolls every ancestor, including the
    // overflow-hidden reader, which then slides the running head off-screen
    // and pulls the hidden dock (parked just below it) into view.
    root.scrollTop += el.getBoundingClientRect().top - root.getBoundingClientRect().top
    lastReported.current = target
    pendingJump.current = null
    markAnchor(target)
    anchorScrollTop.current = containerRef.current?.scrollTop ?? 0
  })

  // Scroll-anchor compensation — see the component doc comment. It does nothing
  // while a jump is pending: the jump itself places the page, and the
  // "anchor" is still the old page until that lands.
  useLayoutEffect(() => {
    for (const [page, el] of pageEls.current) heightCache.current.set(page, el.offsetHeight / scaleRef.current)
    // A page still showing its loading skeleton (sized to stay under this
    // floor) or the font-check step in between reports a real but short height —
    // averaging those in collapses the estimate toward zero, which then
    // throws off the spacer sizing and the fling safety-net's page guess.
    // A real rendered mushaf page is always well above this floor.
    const measured = [...heightCache.current.values()].filter((h) => h > 400)
    if (measured.length) {
      const avg = measured.reduce((sum, h) => sum + h, 0) / measured.length
      // A hard floor/ceiling around the range real pages actually render at —
      // belt-and-braces against any one bad sample still swinging the
      // estimate far enough to throw off the fling safety-net's page guess.
      avgHeight.current = Math.min(2400, Math.max(700, avg))
    }
    holdAnchor()
    // Every render, not only when pages arrive: a render for any other reason
    // still resizes the spacers to the latest average.
  })

  // Heights also change between renders — a page's glyph font arriving, the
  // spacers taking the new average — and each must be undone the same way.
  useEffect(() => {
    const content = contentRef.current
    if (!content || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => holdAnchor())
    observer.observe(content)
    for (const el of pageEls.current.values()) observer.observe(el)
    return () => observer.disconnect()
  }, [holdAnchor, version])

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
        if (best && performance.now() < followingUntil.current) return
        if (best && best.page !== lastReported.current && pendingJump.current === null) {
          lastReported.current = best.page
          // The anchor itself just changed: measure the new one afresh.
          markAnchor(best.page)
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
  }, [ensureLoaded, markAnchor, onPageChange, version])

  // Where the reader has scrolled to, so a pull-back by the browser can be told apart.
  useEffect(() => {
    const root = containerRef.current
    if (!root) return
    const onScroll = () => {
      // Only a scroll short of the end: a pull-back always lands exactly on it.
      if (root.scrollTop < root.scrollHeight - root.clientHeight - 1) lastScrollTop.current = root.scrollTop
    }
    root.addEventListener('scroll', onScroll, { passive: true })
    return () => root.removeEventListener('scroll', onScroll)
  }, [])

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
        // Only for a screen showing no page at all; while one is in view, the observer has it.
        const view = root.getBoundingClientRect()
        for (const el of pageEls.current.values()) {
          const box = el.getBoundingClientRect()
          if (box.bottom > view.top && box.top < view.bottom) return
        }
        // Relative to the last confirmed-correct (page, scrollTop) pair, not
        // absolute position from zero — immune to a transient blip in the
        // spacer math anywhere else in the document.
        const pagesMoved = Math.round((root.scrollTop - anchorScrollTop.current) / (avgHeight.current * scaleRef.current))
        const approx = Math.min(totalPages, Math.max(1, lastReported.current + pagesMoved))
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

  // When the recitation moves on to the next ayah, bring it into view. It is left alone if it
  // is already in the upper part of the screen, so a line-by-line read is not constantly nudged.
  useEffect(() => {
    if (!followVerseKey) return
    const root = containerRef.current
    if (!root) return
    const el = root.querySelector<HTMLElement>(`[data-verse-key="${followVerseKey}"]`)
    if (!el) return
    const rootRect = root.getBoundingClientRect()
    const top = el.getBoundingClientRect().top - rootRect.top
    if (top >= rootRect.height * 0.1 && top <= rootRect.height * 0.6) return
    followingUntil.current = performance.now() + 1200
    root.scrollTo({ top: root.scrollTop + top - rootRect.height * 0.28, behavior: 'smooth' })
  }, [followVerseKey])

  // Pinch with two fingers to make the script smaller or larger. One finger still
  // scrolls as before. The size is a CSS variable the flowing text is multiplied by.
  useEffect(() => {
    const root = containerRef.current
    if (!root) return

    const setScale = (next: number) => {
      const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, next))
      if (Math.abs(scale - scaleRef.current) < 0.002) return
      // Keep what is on screen where it is: note how far down the page in view the top
      // edge of the screen is, resize, then put it back at the same fraction.
      const el = pageEls.current.get(lastReported.current)
      let fraction = 0
      if (el) {
        const top = el.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop
        fraction = (root.scrollTop - top) / Math.max(1, el.offsetHeight)
      }
      scaleRef.current = scale
      root.style.setProperty('--mushaf-flow-scale', String(scale))
      if (el) {
        const top = el.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop
        root.scrollTop = top + fraction * el.offsetHeight
      }
      // Every page changed height and the screen is already set right: take that as the anchor,
      // for keeping the page still and for the fling safety-net's page guess alike.
      anchorScrollTop.current = root.scrollTop
      markAnchor(lastReported.current)
      if (scaleSaveRef.current !== null) window.clearTimeout(scaleSaveRef.current)
      scaleSaveRef.current = window.setTimeout(() => {
        scaleSaveRef.current = null
        setVersion((n) => n + 1)
        try {
          localStorage.setItem(SCALE_KEY, String(scaleRef.current))
        } catch {
          // The size just is not remembered.
        }
      }, 250)
    }

    setScale(readSavedScale())

    let start: { distance: number; scale: number } | null = null
    const distance = (e: TouchEvent) =>
      Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY)

    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 2) start = { distance: distance(e), scale: scaleRef.current }
    }
    const onMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || !start) return
      // The browser must not also treat this as a scroll or a page zoom.
      e.preventDefault()
      setScale(start.scale * (distance(e) / Math.max(1, start.distance)))
    }
    const onEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) start = null
    }

    root.addEventListener('touchstart', onStart, { passive: true })
    root.addEventListener('touchmove', onMove, { passive: false })
    root.addEventListener('touchend', onEnd, { passive: true })
    root.addEventListener('touchcancel', onEnd, { passive: true })
    return () => {
      root.removeEventListener('touchstart', onStart)
      root.removeEventListener('touchmove', onMove)
      root.removeEventListener('touchend', onEnd)
      root.removeEventListener('touchcancel', onEnd)
      if (scaleSaveRef.current !== null) window.clearTimeout(scaleSaveRef.current)
    }
  }, [])

  const orderedPages = [...dataRef.current.keys()].sort((a, b) => a - b)
  const firstLoaded = orderedPages[0] ?? currentPage
  const lastLoaded = orderedPages[orderedPages.length - 1] ?? currentPage
  const topSpacerHeight = Math.max(0, firstLoaded - 1) * avgHeight.current
  const bottomSpacerHeight = Math.max(0, totalPages - lastLoaded) * avgHeight.current
  // Unzoomed estimates times the zoom, worked out by the browser: a pinch resizes them with the pages.
  const zoomed = (px: number) => `calc(${Math.round(px)}px * var(--mushaf-flow-scale, 1))`

  return (
    <div ref={containerRef} className="h-full overflow-y-auto overscroll-contain [overflow-anchor:none] [touch-action:pan-y]">
      <div ref={contentRef}>
      {topSpacerHeight > 0 && <div style={{ height: zoomed(topSpacerHeight) }} aria-hidden />}
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
          <div className="mushaf-flow-divider" aria-hidden>
            <span>{page}</span>
          </div>
        </div>
      ))}
      {bottomSpacerHeight > 0 && <div style={{ height: zoomed(bottomSpacerHeight) }} aria-hidden />}
      </div>
    </div>
  )
}
