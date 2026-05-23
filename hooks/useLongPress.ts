'use client'

import { useCallback, useRef } from 'react'

const DEFAULT_DELAY_MS = 480

export function useLongPress(onLongPress: () => void, delayMs = DEFAULT_DELAY_MS) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const firedRef = useRef(false)

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const start = useCallback(() => {
    clear()
    firedRef.current = false
    timerRef.current = setTimeout(() => {
      firedRef.current = true
      onLongPress()
    }, delayMs)
  }, [clear, delayMs, onLongPress])

  const end = useCallback(() => {
    clear()
  }, [clear])

  const consumeFired = useCallback(() => {
    const fired = firedRef.current
    firedRef.current = false
    return fired
  }, [])

  const handlers = {
    onTouchStart: start,
    onTouchEnd: end,
    onTouchMove: end,
    onTouchCancel: end,
    onMouseDown: start,
    onMouseUp: end,
    onMouseLeave: end,
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault()
      firedRef.current = true
      onLongPress()
    },
  }

  return { handlers, consumeFired }
}
