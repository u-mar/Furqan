'use client'

import { useState } from 'react'
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
 * Reciter portrait. Uses `/reciters/<id>.jpg` when the file exists, otherwise
 * falls back to a calligraphic initials tile in the reciter's accent gradient.
 * Drop photos into `public/reciters/` to light them up — no code change needed.
 */
export default function ReciterAvatar({
  reciter,
  size = 56,
  className,
  ring = false,
  square = false,
}: ReciterAvatarProps) {
  const [failed, setFailed] = useState(false)
  const [from, to] = reciter.accent

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
      {!failed && (
        <img
          src={`/reciters/${reciter.id}.jpg`}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
          onError={() => setFailed(true)}
        />
      )}
      {failed && (
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
