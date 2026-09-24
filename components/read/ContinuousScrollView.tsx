'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type { Verse } from '@/types'

/** Pages kept loaded on each side of the one showing. */
const WINDOW_RADIUS = 2
/** Pages this far from the current one are dropped to bound memory. */
const PRUNE_RADIUS = 6

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
 * Pages load in (and get pruned out) asynchronously, and some of that always
 * lands *above* whatever's on screen — the browser has no idea that's what
 * happened, so it leaves `scrollTop` at the same pixel offset, which now
 * points at different content than a moment ago. This is the standard
 * "scroll anchoring" problem virtualized lists have; the layout effect below
 * measures what changed above the page currently showing and nudges
 * `scrollTop` by exactly that amount, so nothing visibly moves.
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
  const prevOrder = useRef<number[]>([])
  const lastReported = useRef(currentPage)
  const pendingJump = useRef<number | null>(currentPage)

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

  // Runs after every render — cheap, and it's the simplest way to wait until
  // a jump's target page has actually mounted before scrolling to it.
  useEffect(() => {
    if (pendingJump.current === null) return
    const target = pendingJump.current
    const el = pageEls.current.get(target)
    if (!el) return
    el.scrollIntoView({ block: 'start' })
    lastReported.current = target
    pendingJump.current = null
  })

  // Scroll-anchor compensation — see the component doc comment. Skipped
  // while a jump is pending: the target's own scrollIntoView (above)
  // supersedes it, and the "anchor" is still the old page until that lands.
  useLayoutEffect(() => {
    for (const [page, el] of pageEls.current) heightCache.current.set(page, el.offsetHeight)

    if (pendingJump.current === null) {
      const anchor = lastReported.current
      const newOrder = [...dataRef.current.keys()].sort((a, b) => a - b)
      const anchorIndex = newOrder.indexOf(anchor)
      if (anchorIndex !== -1) {
        let delta = 0
        for (const page of newOrder.slice(0, anchorIndex)) {
          if (!prevOrder.current.includes(page)) delta += heightCache.current.get(page) ?? 0
        }
        const anchorWasAt = prevOrder.current.indexOf(anchor)
        if (anchorWasAt !== -1) {
          for (const page of prevOrder.current.slice(0, anchorWasAt)) {
            if (!newOrder.includes(page)) delta -= heightCache.current.get(page) ?? 0
          }
        }
        if (delta !== 0 && containerRef.current) containerRef.current.scrollTop += delta
      }
      prevOrder.current = newOrder
    }
  }, [version])

  useEffect(() => {
    const root = containerRef.current
    if (!root) return
    const observer = new IntersectionObserver(
      (entries) => {
        let best: { page: number; ratio: number } | null = null
        for (const entry of entries) {
          const page = Number((entry.target as HTMLElement).dataset.page)
          if (!page || !entry.isIntersecting) continue
          if (!best || entry.intersectionRatio > best.ratio) best = { page, ratio: entry.intersectionRatio }
        }
        if (best && best.page !== lastReported.current && pendingJump.current === null) {
          lastReported.current = best.page
          ensureLoaded(best.page)
          onPageChange(best.page)
        }
      },
      { root, threshold: [0.5] }
    )
    for (const el of pageEls.current.values()) observer.observe(el)
    return () => observer.disconnect()
  }, [ensureLoaded, onPageChange, version])

  const orderedPages = [...dataRef.current.keys()].sort((a, b) => a - b)

  return (
    <div ref={containerRef} className="h-full overflow-y-auto overscroll-contain">
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
    </div>
  )
}
