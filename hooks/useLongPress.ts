'use client'

import { useCallback, useRef } from 'react'

/**
 * Two quick taps on an ayah, not a long press — people were finding a hold
 * hard to land. The name is kept (and so is the shape it returns) since a
 * handful of components across Read spread `handlers` onto the same word or
 * line; only what counts as "pressed" changes here.
 */

const DEFAULT_DOUBLE_TAP_MS = 350
/** More than this and it's a scroll, not a tap. */
const MOVE_TOLERANCE_PX = 10

export function useLongPress(onLongPress: () => void, doubleTapMs = DEFAULT_DOUBLE_TAP_MS) {
  const lastTapAt = useRef(0)
  const firedRef = useRef(false)
  const startPoint = useRef<{ x: number; y: number } | null>(null)
  const movedRef = useRef(false)

  const registerTap = useCallback(() => {
    const now = Date.now()
    if (now - lastTapAt.current <= doubleTapMs) {
      lastTapAt.current = 0
      firedRef.current = true
      onLongPress()
    } else {
      lastTapAt.current = now
    }
  }, [doubleTapMs, onLongPress])

  const start = useCallback((x: number, y: number) => {
    startPoint.current = { x, y }
    movedRef.current = false
  }, [])

  const move = useCallback((x: number, y: number) => {
    const from = startPoint.current
    if (!from) return
    if (Math.abs(x - from.x) > MOVE_TOLERANCE_PX || Math.abs(y - from.y) > MOVE_TOLERANCE_PX) {
      movedRef.current = true
    }
  }, [])

  const end = useCallback(() => {
    if (!movedRef.current) registerTap()
    startPoint.current = null
  }, [registerTap])

  const cancel = useCallback(() => {
    startPoint.current = null
  }, [])

  const handlers = {
    onTouchStart: (e: React.TouchEvent) => {
      const touch = e.touches[0]
      if (touch) start(touch.clientX, touch.clientY)
    },
    onTouchMove: (e: React.TouchEvent) => {
      const touch = e.touches[0]
      if (touch) move(touch.clientX, touch.clientY)
    },
    onTouchEnd: end,
    onTouchCancel: cancel,
    onMouseDown: (e: React.MouseEvent) => start(e.clientX, e.clientY),
    onMouseUp: (e: React.MouseEvent) => {
      move(e.clientX, e.clientY)
      end()
    },
    onMouseLeave: cancel,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  }

  const consumeFired = useCallback(() => {
    const fired = firedRef.current
    firedRef.current = false
    return fired
  }, [])

  return { handlers, consumeFired }
}
