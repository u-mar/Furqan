'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/cn'
import { backgroundReel, type VideoBackground } from '@/lib/qari-backgrounds'

/**
 * A recitation's background filling its box: the picture, the clip itself for
 * a moving one while `moving` (its still frame otherwise), or a soft black.
 * `drift` adds the slow Ken Burns pan to a still picture (a clip already moves);
 * `paused` holds both the pan and the clip.
 */
export default function BackgroundCover({
  background,
  moving = false,
  drift = false,
  paused = false,
  small = false,
  className,
}: {
  background: VideoBackground
  moving?: boolean
  drift?: boolean
  paused?: boolean
  /** Use the small copy — for thumbnails. */
  small?: boolean
  className?: string
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const clip = moving && background.videoUrl ? background.videoUrl : null
  // A clip of a kind moves on to the others like it, as the shared video does.
  const reel = useMemo(() => (clip ? backgroundReel(background) : []), [clip, background])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (paused) video.pause()
    else void video.play().catch(() => {})
  }, [paused, clip])

  const src = small ? (background.thumb ?? background.url) : background.url
  // The slow pan is for a still picture. On a clip it moved against the clip's own
  // motion, which looked like the screen shaking, and rescaling a playing video
  // every frame made it stutter on phones.
  const panned = drift && !clip
  const media = cn('absolute inset-0 h-full w-full object-cover', panned && 'qari-kenburns', panned && paused && 'is-paused')

  return (
    <div className={cn('absolute inset-0 overflow-hidden bg-[#070707]', className)} aria-hidden>
      {!src ? (
        <div className="absolute inset-0 bg-[radial-gradient(110%_75%_at_50%_38%,#232323,#060606)]" />
      ) : clip && reel.length > 1 ? (
        <ClipReel key={background.id} reel={reel} paused={paused} className={media} />
      ) : clip ? (
        <video
          key={clip}
          ref={videoRef}
          src={clip}
          poster={background.url ?? undefined}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          className={media}
        />
      ) : (
        <img key={src} src={src} alt="" decoding="async" draggable={false} className={media} />
      )}
    </div>
  )
}

/**
 * Each clip of the reel once through, then the next. Two players take turns: while one
 * shows, the other has the next clip loaded and waiting, so the cut is clean.
 */
function ClipReel({ reel, paused, className }: { reel: VideoBackground[]; paused: boolean; className: string }) {
  const first = useRef<HTMLVideoElement | null>(null)
  const second = useRef<HTMLVideoElement | null>(null)
  const [step, setStep] = useState(0)
  const showing = step % 2

  useEffect(() => {
    const video = (showing === 0 ? first : second).current
    if (!video) return
    if (paused) video.pause()
    else void video.play().catch(() => {})
  }, [paused, showing])

  return (
    <>
      {[first, second].map((ref, slot) => {
        const shown = slot === showing
        const clip = reel[(shown ? step : step + 1) % reel.length]
        return (
          <video
            key={slot}
            ref={ref}
            src={clip.videoUrl ?? undefined}
            poster={shown ? (clip.url ?? undefined) : undefined}
            muted
            playsInline
            preload="auto"
            onEnded={shown ? () => setStep((n) => n + 1) : undefined}
            className={cn(className, !shown && 'invisible')}
          />
        )
      })}
    </>
  )
}
