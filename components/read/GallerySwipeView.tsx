'use client'

import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type TouchEvent as ReactTouchEvent,
} from 'react'
import { tapFeedback } from '@/lib/haptics'

interface GallerySwipeViewProps {
  /** Changes only when the parent has actually committed to a new page. */
  pageKey: number
  current: ReactNode
  prev: ReactNode | null
  next: ReactNode | null
  onCommitNext: () => void
  onCommitPrev: () => void
  /** Fired once a gesture is confirmed as a page-drag (not a tap). */
  onDragStart?: () => void
  /** Drag up/down instead of left/right. */
  vertical?: boolean
}

interface Gesture {
  locked: 'main' | 'cross' | null
  startMain: number
  startCross: number
  lastMain: number
  lastT: number
  velocity: number
  size: number
}

const COMMIT_RATIO = 0.28
const COMMIT_VELOCITY = 0.5 // px/ms
const DEAD_ZONE = 6
const SETTLE_MS = 240
const PANEL = 'mushaf-turn-panel mushaf-sheet absolute h-full w-full'
/**
 * Where each panel sits. Vertical (dragging up advances): next below, prev above. Horizontal, the
 * book-flip convention: next to the left, prev to the right, so a rightward drag reveals it.
 */
const PLACE = {
  y: { next: 'inset-x-0 top-full', current: 'inset-0', prev: 'inset-x-0 bottom-full' },
  x: { next: 'inset-y-0 right-full', current: 'inset-0', prev: 'inset-y-0 left-full' },
} as const

/**
 * Gallery/photo-style page swipe: the incoming page follows the finger in
 * real time (draggable halfway to peek, reversible mid-drag) instead of an
 * instant/no-animation page swap. Prev/next panels are pre-rendered by the
 * caller so there's no loading gap while dragging.
 *
 * Horizontal (the mushaf's default): book-flip convention, dragging right
 * advances — next sits to the left, prev to the right.
 * Vertical (page swipes turned on in Settings): dragging up advances — next
 * sits below, prev above, matching a normal scroll-down-to-continue feel.
 */
export default function GallerySwipeView({
  pageKey,
  current,
  prev,
  next,
  onCommitNext,
  onCommitPrev,
  onDragStart,
  vertical = false,
}: GallerySwipeViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const trackRef = useRef<HTMLDivElement | null>(null)
  const gestureRef = useRef<Gesture | null>(null)
  const [settling, setSettling] = useState(false)

  const setTransform = useCallback(
    (px: number, animated: boolean) => {
      const track = trackRef.current
      if (!track) return
      track.style.transition = animated
        ? `transform ${SETTLE_MS}ms cubic-bezier(0.22, 0.61, 0.36, 1)`
        : 'none'
      track.style.transform = vertical ? `translateY(${px}px)` : `translateX(${px}px)`
    },
    [vertical]
  )

  // The parent has landed on a new page — the "current" slot already shows
  // it, so resetting to 0 here is visually a no-op.
  useLayoutEffect(() => {
    setTransform(0, false)
    setSettling(false)
  }, [pageKey, setTransform])

  const onTouchStart = useCallback(
    (e: ReactTouchEvent<HTMLDivElement>) => {
      if (settling) return
      const touch = e.touches[0]
      const rect = containerRef.current?.getBoundingClientRect()
      const size = (vertical ? rect?.height : rect?.width) || 1
      gestureRef.current = {
        locked: null,
        startMain: vertical ? touch.clientY : touch.clientX,
        startCross: vertical ? touch.clientX : touch.clientY,
        lastMain: vertical ? touch.clientY : touch.clientX,
        lastT: e.timeStamp,
        velocity: 0,
        size,
      }
    },
    [settling, vertical]
  )

  const onTouchMove = useCallback(
    (e: ReactTouchEvent<HTMLDivElement>) => {
      const g = gestureRef.current
      if (!g) return
      const touch = e.touches[0]
      const main = vertical ? touch.clientY : touch.clientX
      const cross = vertical ? touch.clientX : touch.clientY
      const dMain = main - g.startMain
      const dCross = cross - g.startCross

      if (!g.locked) {
        if (Math.abs(dMain) < DEAD_ZONE && Math.abs(dCross) < DEAD_ZONE) return
        g.locked = Math.abs(dMain) > Math.abs(dCross) ? 'main' : 'cross'
        if (g.locked === 'main') onDragStart?.()
      }
      if (g.locked !== 'main') return

      // Clamp the minimum interval so two samples arriving almost
      // simultaneously can't produce a spuriously huge velocity.
      const dt = Math.max(8, e.timeStamp - g.lastT)
      g.velocity = (main - g.lastMain) / dt
      g.lastMain = main
      g.lastT = e.timeStamp

      // Horizontal: dragging right advances (book-flip). Vertical: dragging
      // up advances (scroll-down-to-continue), so the sign is flipped.
      const goingNext = vertical ? dMain < 0 : dMain > 0
      const atEnd = goingNext && !next
      const atStart = !goingNext && !prev
      const effectiveMain = atStart || atEnd ? dMain * 0.3 : dMain
      setTransform(effectiveMain, false)
    },
    [prev, next, onDragStart, setTransform, vertical]
  )

  const finishGesture = useCallback(() => {
    const g = gestureRef.current
    gestureRef.current = null
    if (!g || g.locked !== 'main') return

    const dMain = g.lastMain - g.startMain
    const goingNext = vertical ? dMain < 0 : dMain > 0
    const canCommit = goingNext ? Boolean(next) : Boolean(prev)
    const passedDistance = Math.abs(dMain) > g.size * COMMIT_RATIO
    // A minimum real distance guards against misreading jitter as a flick —
    // two touchmove samples very close in time can otherwise yield a huge
    // (dMain / dt) velocity from a near-zero movement.
    const passedVelocity =
      Math.abs(dMain) > 15 &&
      Math.abs(g.velocity) > COMMIT_VELOCITY &&
      (vertical ? g.velocity < 0 : g.velocity > 0) === goingNext
    const shouldCommit = canCommit && (passedDistance || passedVelocity)

    setSettling(true)
    if (shouldCommit) {
      const commitTo = vertical
        ? goingNext ? -g.size : g.size
        : goingNext ? g.size : -g.size
      setTransform(commitTo, true)
      tapFeedback()
      window.setTimeout(() => {
        if (goingNext) onCommitNext()
        else onCommitPrev()
      }, SETTLE_MS)
    } else {
      setTransform(0, true)
      window.setTimeout(() => setSettling(false), SETTLE_MS)
    }
  }, [next, prev, onCommitNext, onCommitPrev, setTransform, vertical])

  const panels = [
    next ? { page: pageKey + 1, node: next, role: 'next' as const } : null,
    { page: pageKey, node: current, role: 'current' as const },
    prev ? { page: pageKey - 1, node: prev, role: 'prev' as const } : null,
  ].filter((panel): panel is NonNullable<typeof panel> => panel !== null)

  return (
    <div
      ref={containerRef}
      className="mushaf-turn relative h-full w-full overflow-hidden"
      data-axis={vertical ? 'y' : 'x'}
    >
      <div
        ref={trackRef}
        className="relative h-full w-full"
        // The page never scrolls, so every touch is ours: left to the browser, the
        // up-and-down part of a sideways swipe nudged the whole page (the bounce on
        // iPhone, the address bar sliding away on Android).
        style={{ willChange: 'transform', touchAction: 'none' }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={finishGesture}
        onTouchCancel={finishGesture}
      >
        {/* One list keyed by page number: turning a page only moves the panels, so the page turned to
            (already built as the neighbour, its lines fitted) is kept, not built again from scratch,
            and only the new neighbour is built. In three fixed slots every turn rebuilt all three. */}
        {panels.map((panel) => (
          <div key={panel.page} className={`${PANEL} ${PLACE[vertical ? 'y' : 'x'][panel.role]}`}>
            {panel.node}
          </div>
        ))}
      </div>
    </div>
  )
}
