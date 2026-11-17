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
  /** Shown at once on opening (Home's large reciter): fetched straight away, not when scrolled to. */
  eager?: boolean
}

/**
 * Reciter portrait. Tries the reciter's `photoUrl` (way2quran.com) first, then
 * a local override at `/reciters/<id>.jpg` (drop a file there to use it
 * instead — no code change needed), and finally falls back to a calligraphic
 * initials tile in the reciter's accent gradient.
 *
 * While the photo is on its way the circle is a quiet neutral, and the photo fades in over it.
 * It used to be the accent gradient, so every screen flashed the reciter's Listen colour first.
 */
export default function ReciterAvatar({
  reciter,
  size = 56,
  className,
  ring = false,
  square = false,
  eager = false,
}: ReciterAvatarProps) {
  const candidates = [reciter.photoUrl, `/reciters/${reciter.id}.jpg`].filter(
    (url): url is string => Boolean(url)
  )
  const [attempt, setAttempt] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const [from, to] = reciter.accent
  const exhausted = attempt >= candidates.length

  // Reset the attempt counter whenever we're asked to show a different reciter.
  useEffect(() => {
    setAttempt(0)
    setLoaded(false)
  }, [reciter.id])

  return (
    <span
      className={cn(
        'relative flex shrink-0 items-center justify-center overflow-hidden',
        square ? 'rounded-[1.75rem]' : 'rounded-full',
        className
      )}
      style={{
        width: size,
        height: size,
        background: exhausted ? `linear-gradient(145deg, ${from}, ${to})` : 'var(--home-track)',
        outline: ring ? '2px solid var(--home-heading)' : undefined,
        outlineOffset: ring ? 2 : undefined,
      }}
    >
      {!exhausted && (
        <img
          key={candidates[attempt]}
          src={candidates[attempt]}
          alt=""
          className={cn(
            'absolute inset-0 h-full w-full object-cover transition-opacity duration-300',
            loaded ? 'opacity-100' : 'opacity-0'
          )}
          decoding="async"
          loading={eager ? 'eager' : 'lazy'}
          referrerPolicy="no-referrer"
          // A photo already in the cache can finish before React listens: checked as it mounts too.
          ref={(img) => {
            if (img?.complete && img.naturalWidth > 0) setLoaded(true)
          }}
          onLoad={() => setLoaded(true)}
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
