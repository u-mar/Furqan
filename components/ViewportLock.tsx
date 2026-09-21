'use client'

import { useEffect } from 'react'

/**
 * Stops the page from zooming by accident. iPhones ignore `user-scalable=no`
 * for a pinch, so the pinch itself is cancelled here: one stray two-finger
 * touch (or a double-tap in the wrong place) otherwise leaves the whole app
 * enlarged, most noticeably over the mushaf, with no way back but another pinch.
 */
export default function ViewportLock() {
  useEffect(() => {
    const stop = (e: Event) => e.preventDefault()
    const onTouchMove = (e: TouchEvent) => {
      // Two fingers moving apart or together is a pinch.
      if (e.touches.length > 1) e.preventDefault()
    }
    document.addEventListener('gesturestart', stop)
    document.addEventListener('gesturechange', stop)
    document.addEventListener('gestureend', stop)
    document.addEventListener('touchmove', onTouchMove, { passive: false })
    return () => {
      document.removeEventListener('gesturestart', stop)
      document.removeEventListener('gesturechange', stop)
      document.removeEventListener('gestureend', stop)
      document.removeEventListener('touchmove', onTouchMove)
    }
  }, [])

  return null
}
