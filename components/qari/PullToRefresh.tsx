'use client'

import { useEffect, useRef, useState } from 'react'
import { RotateCw } from 'lucide-react'
import { strongFeedback } from '@/lib/haptics'

const TRIGGER = 64
const MAX_PULL = 110

/**
 * Pull down at the top of a list to refresh it.
 *
 * The browser's own pull-to-refresh reloads the whole app, so it is switched
 * off while a list that refreshes itself is on screen.
 */
export function usePullToRefresh(onRefresh: () => Promise<unknown>) {
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const refreshRef = useRef(onRefresh)
  const busyRef = useRef(false)

  useEffect(() => {
    refreshRef.current = onRefresh
  })

  useEffect(() => {
    const root = document.documentElement
    const previous = root.style.overscrollBehaviorY
    root.style.overscrollBehaviorY = 'contain'

    let startY: number | null = null
    let distance = 0
    let armed = false

    const onStart = (e: TouchEvent) => {
      startY = window.scrollY <= 0 && !busyRef.current ? e.touches[0].clientY : null
      distance = 0
      armed = false
    }
    const onMove = (e: TouchEvent) => {
      if (startY === null) return
      const dy = e.touches[0].clientY - startY
      if (dy <= 0 || window.scrollY > 0) {
        if (distance !== 0) setPull(0)
        distance = 0
        return
      }
      distance = Math.min(MAX_PULL, dy * 0.5)
      if (!armed && distance >= TRIGGER) {
        armed = true
        strongFeedback()
      }
      setPull(distance)
    }
    const onEnd = async () => {
      if (startY === null) return
      startY = null
      if (distance < TRIGGER) {
        setPull(0)
        return
      }
      busyRef.current = true
      setRefreshing(true)
      setPull(52)
      try {
        await refreshRef.current()
      } finally {
        busyRef.current = false
        setRefreshing(false)
        setPull(0)
      }
    }

    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onEnd)
    window.addEventListener('touchcancel', onEnd)
    return () => {
      root.style.overscrollBehaviorY = previous
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
      window.removeEventListener('touchcancel', onEnd)
    }
  }, [])

  return { pull, refreshing }
}

export function PullIndicator({ pull, refreshing }: { pull: number; refreshing: boolean }) {
  if (pull <= 0 && !refreshing) return null
  const ready = pull >= TRIGGER || refreshing
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-30 flex justify-center"
      style={{ transform: `translateY(${Math.max(0, pull - 18)}px)`, transition: refreshing ? 'transform 0.2s ease' : undefined }}
      aria-hidden
    >
      <span className="ed-card flex h-9 w-9 items-center justify-center rounded-full text-[var(--home-sage)] shadow-lg">
        <RotateCw
          className={refreshing ? 'h-4 w-4 animate-spin' : 'h-4 w-4'}
          strokeWidth={2.4}
          style={refreshing ? undefined : { transform: `rotate(${pull * 3}deg)`, opacity: ready ? 1 : 0.55 }}
        />
      </span>
    </div>
  )
}
