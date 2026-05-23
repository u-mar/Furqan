'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

export type PageSlideDirection = 'next' | 'prev'

interface MushafPageCarouselProps {
  /** Vertical stack (pages slide up/down). Horizontal = pages slide left/right. */
  vertical: boolean
  /** When set, animates from current panel to incoming, then calls onSettled. */
  slide: { direction: PageSlideDirection; incoming: ReactNode } | null
  onSettled: () => void
  children: ReactNode
}

const DURATION_MS = 320

export default function MushafPageCarousel({
  vertical,
  slide,
  onSettled,
  children,
}: MushafPageCarouselProps) {
  const [offset, setOffset] = useState(false)
  const onSettledRef = useRef(onSettled)
  onSettledRef.current = onSettled

  useEffect(() => {
    if (!slide) {
      setOffset(false)
      return
    }
    setOffset(false)
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => setOffset(true))
    })
    const timer = window.setTimeout(() => {
      onSettledRef.current()
      setOffset(false)
    }, DURATION_MS)
    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(timer)
    }
  }, [slide])

  if (!slide) {
    return <div className="h-full w-full">{children}</div>
  }

  const { direction, incoming } = slide
  const panels =
    direction === 'next'
      ? (
          <>
            <div className="h-full w-full shrink-0">{children}</div>
            <div className="h-full w-full shrink-0">{incoming}</div>
          </>
        )
      : (
          <>
            <div className="h-full w-full shrink-0">{incoming}</div>
            <div className="h-full w-full shrink-0">{children}</div>
          </>
        )

  if (vertical) {
    const startY = direction === 'next' ? '0%' : '-50%'
    const endY = direction === 'next' ? '-50%' : '0%'
    return (
      <div className="h-full w-full overflow-hidden">
        <div
          className="flex h-[200%] w-full flex-col transition-transform ease-out"
          style={{
            transitionDuration: `${DURATION_MS}ms`,
            transform: offset ? `translateY(${endY})` : `translateY(${startY})`,
          }}
        >
          {panels}
        </div>
      </div>
    )
  }

  const startX = direction === 'next' ? '0%' : '-50%'
  const endX = direction === 'next' ? '-50%' : '0%'
  return (
    <div className="h-full w-full overflow-hidden">
      <div
        className="flex h-full w-[200%] flex-row transition-transform ease-out"
        style={{
          transitionDuration: `${DURATION_MS}ms`,
          transform: offset ? `translateX(${endX})` : `translateX(${startX})`,
        }}
      >
        {panels}
      </div>
    </div>
  )
}
