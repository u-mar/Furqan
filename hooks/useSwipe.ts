'use client'

import { useRef, type TouchEvent } from 'react'

type SwipeDirection = 'horizontal' | 'vertical'

interface UseSwipeOptions {
  direction?: SwipeDirection
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  onSwipeUp?: () => void
  onSwipeDown?: () => void
  threshold?: number
}

export function useSwipe({
  direction = 'horizontal',
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  threshold = 48,
}: UseSwipeOptions) {
  const startX = useRef(0)
  const startY = useRef(0)

  const onTouchStart = (e: TouchEvent) => {
    const touch = e.touches[0]
    startX.current = touch.clientX
    startY.current = touch.clientY
  }

  const onTouchEnd = (e: TouchEvent) => {
    const touch = e.changedTouches[0]
    const dx = touch.clientX - startX.current
    const dy = touch.clientY - startY.current

    if (direction === 'vertical') {
      if (Math.abs(dy) < threshold || Math.abs(dy) < Math.abs(dx)) return
      if (dy < 0) onSwipeUp?.()
      else onSwipeDown?.()
      return
    }

    if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy)) return
    if (dx < 0) onSwipeLeft?.()
    else onSwipeRight?.()
  }

  return { onTouchStart, onTouchEnd }
}
