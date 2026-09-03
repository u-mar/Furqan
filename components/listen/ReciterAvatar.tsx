'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/cn'
import { reciterInitials, type Reciter } from '@/lib/reciters'

interface ReciterAvatarProps {
  reciter: Reciter
  size?: number
  className?: string
  ring?: boolean
  /** Render as rounded album-style art instead of a circle. */
  square?: boolean
}

/**
 * Reciter portrait. Tries the reciter's `photoUrl` (way2quran.com) first, then
 * a local override at `/reciters/<id>.jpg` (drop a file there to use it
 * instead — no code change needed), and finally falls back to a calligraphic
 * initials tile in the reciter's accent gradient.
 */
export default function ReciterAvatar({
  reciter,
  size = 56,
  className,
  ring = false,
  square = false,
}: ReciterAvatarProps) {
  const candidates = [reciter.photoUrl, `/reciters/${reciter.id}.jpg`].filter(
    (url): url is string => Boolean(url)
  )
  const [attempt, setAttempt] = useState(0)
  const [from, to] = reciter.accent
  const exhausted = attempt >= candidates.length

  // Reset the attempt counter whenever we're asked to show a different reciter.
  useEffect(() => {
    setAttempt(0)
  }, [reciter.id])

  return (
    <span
      className={cn(
        'relative flex shrink-0 items-center justify-center overflow-hidden',
        square ? 'rounded-[1.4rem]' : 'rounded-full',
        className
      )}
      style={{
        width: size,
        height: size,
        background: `linear-gradient(145deg, ${from}, ${to})`,
        boxShadow: square ? `0 18px 40px -16px ${to}` : `0 8px 20px -10px ${to}`,
        outline: ring ? `2px solid ${from}` : undefined,
        outlineOffset: ring ? 2 : undefined,
      }}
    >
      {!exhausted && (
        <img
          key={candidates[attempt]}
          src={candidates[attempt]}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setAttempt((a) => a + 1)}
        />
      )}
      {exhausted && (
        <span
          className="relative font-bold text-white"
          style={{ fontSize: Math.max(11, size * 0.34) }}
        >
          {reciterInitials(reciter.name)}
        </span>
      )}
    </span>
  )
}
