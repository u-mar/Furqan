'use client'

import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type TouchEvent as ReactTouchEvent,
} from 'react'

interface GallerySwipeViewProps {
  /** Changes only when the parent has actually committed to a new page. */
  pageKey: number
  current: ReactNode
  prev: ReactNode | null
  next: ReactNode | null
  onCommitNext: () => void
  onCommitPrev: () => void
  /** Fired once a gesture is confirmed as a horizontal page-drag (not a tap). */
  onDragStart?: () => void
}

interface Gesture {
  locked: 'x' | 'y' | null
  startX: number
  startY: number
  lastX: number
  lastT: number
  velocity: number
  width: number
}

const COMMIT_RATIO = 0.28
const COMMIT_VELOCITY = 0.5 // px/ms
const DEAD_ZONE = 6
const SETTLE_MS = 240

/**
 * Gallery/photo-style page swipe: the incoming page follows the finger in
 * real time (draggable halfway to peek, reversible mid-drag) instead of the
 * old instant/no-animation page swap. Prev/next panels are pre-rendered by
 * the caller so there's no loading gap while dragging.
 */
export default function GallerySwipeView({
  pageKey,
  current,
  prev,
  next,
  onCommitNext,
  onCommitPrev,
  onDragStart,
}: GallerySwipeViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const trackRef = useRef<HTMLDivElement | null>(null)
  const gestureRef = useRef<Gesture | null>(null)
  const [settling, setSettling] = useState(false)

  const setTransform = useCallback((px: number, animated: boolean) => {
    const track = trackRef.current
    if (!track) return
    track.style.transition = animated
      ? `transform ${SETTLE_MS}ms cubic-bezier(0.22, 0.61, 0.36, 1)`
      : 'none'
    track.style.transform = `translateX(${px}px)`
  }, [])

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
      const width = containerRef.current?.getBoundingClientRect().width || 1
      gestureRef.current = {
        locked: null,
        startX: touch.clientX,
        startY: touch.clientY,
        lastX: touch.clientX,
        lastT: e.timeStamp,
        velocity: 0,
        width,
      }
    },
    [settling]
  )

  const onTouchMove = useCallback(
    (e: ReactTouchEvent<HTMLDivElement>) => {
      const g = gestureRef.current
      if (!g) return
      const touch = e.touches[0]
      const dx = touch.clientX - g.startX
      const dy = touch.clientY - g.startY

      if (!g.locked) {
        if (Math.abs(dx) < DEAD_ZONE && Math.abs(dy) < DEAD_ZONE) return
        g.locked = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
        if (g.locked === 'x') onDragStart?.()
      }
      if (g.locked !== 'x') return

      // Clamp the minimum interval so two samples arriving almost
      // simultaneously can't produce a spuriously huge velocity.
      const dt = Math.max(8, e.timeStamp - g.lastT)
      g.velocity = (touch.clientX - g.lastX) / dt
      g.lastX = touch.clientX
      g.lastT = e.timeStamp

      // Book-flip convention: dragging right advances to the next page.
      const atEnd = dx > 0 && !next
      const atStart = dx < 0 && !prev
      const effectiveDx = atStart || atEnd ? dx * 0.3 : dx
      setTransform(effectiveDx, false)
    },
    [prev, next, onDragStart, setTransform]
  )

  const finishGesture = useCallback(() => {
    const g = gestureRef.current
    gestureRef.current = null
    if (!g || g.locked !== 'x') return

    const dx = g.lastX - g.startX
    // Book-flip convention: dragging right advances to the next page.
    const goingNext = dx > 0
    const canCommit = goingNext ? Boolean(next) : Boolean(prev)
    const passedDistance = Math.abs(dx) > g.width * COMMIT_RATIO
    // A minimum real distance guards against misreading jitter as a flick —
    // two touchmove samples very close in time can otherwise yield a huge
    // (dx / dt) velocity from a near-zero movement.
    const passedVelocity =
      Math.abs(dx) > 15 &&
      Math.abs(g.velocity) > COMMIT_VELOCITY &&
      (g.velocity > 0) === goingNext
    const shouldCommit = canCommit && (passedDistance || passedVelocity)

    setSettling(true)
    if (shouldCommit) {
      setTransform(goingNext ? g.width : -g.width, true)
      window.setTimeout(() => {
        if (goingNext) onCommitNext()
        else onCommitPrev()
      }, SETTLE_MS)
    } else {
      setTransform(0, true)
      window.setTimeout(() => setSettling(false), SETTLE_MS)
    }
  }, [next, prev, onCommitNext, onCommitPrev, setTransform])

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden">
      <div
        ref={trackRef}
        className="relative h-full w-full"
        style={{ willChange: 'transform' }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={finishGesture}
        onTouchCancel={finishGesture}
      >
        {/* Book-flip convention: next sits to the left, prev to the right — a
            rightward drag reveals it, following the finger naturally. */}
        {next ? <div className="absolute inset-y-0 right-full h-full w-full">{next}</div> : null}
        <div className="absolute inset-0 h-full w-full">{current}</div>
        {prev ? <div className="absolute inset-y-0 left-full h-full w-full">{prev}</div> : null}
      </div>
    </div>
  )
}
