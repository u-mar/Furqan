'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * A number that rolls to its new value instead of jumping, so a count that
 * changes (3 of 8 have read → 4 of 8) is noticed. The first value shows as is.
 */
export function useCountUp(value: number, durationMs = 450): number {
  const [shown, setShown] = useState(value)
  const from = useRef(value)

  useEffect(() => {
    const start = from.current
    from.current = value
    if (start === value) return
    if (typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(value)
      return
    }
    const began = performance.now()
    let frame = requestAnimationFrame(function step(now) {
      const t = Math.min(1, (now - began) / durationMs)
      const eased = 1 - Math.pow(1 - t, 3)
      setShown(Math.round(start + (value - start) * eased))
      if (t < 1) frame = requestAnimationFrame(step)
    })
    return () => cancelAnimationFrame(frame)
  }, [value, durationMs])

  return shown
}
