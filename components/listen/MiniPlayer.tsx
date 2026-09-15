'use client'

import { useEffect } from 'react'
import ReciterAvatar from '@/components/listen/ReciterAvatar'
import { PlayPauseButton, SkipButton } from '@/components/listen/PlayerControls'
import { useListenProgress, useListenState } from '@/hooks/useListen'
import { cn } from '@/lib/cn'
import { SKIP_SECONDS } from '@/lib/listen-player'
import { getReciterById } from '@/lib/reciters'

/** The player along the bottom of Listen. Tap it for Now playing. */
export default function MiniPlayer({ onOpen }: { onOpen: () => void }) {
  const { surah, reciterId, status, error } = useListenState()
  const showing = Boolean(surah && reciterId)

  // Messages sit above the player instead of behind it.
  useEffect(() => {
    if (!showing) return
    document.documentElement.style.setProperty('--toast-lift', '5.25rem')
    return () => {
      document.documentElement.style.removeProperty('--toast-lift')
    }
  }, [showing])

  if (!surah || !reciterId) return null
  const reciter = getReciterById(reciterId)

  return (
    <div className="listen-mini fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="listen-float mx-auto max-w-lg overflow-hidden rounded-[20px]">
        <Progress />
        <div className="flex items-center gap-1 py-2 pl-2.5 pr-2">
          <button
            type="button"
            onClick={onOpen}
            aria-label={`Open Now playing: ${surah.englishName}`}
            className="ed-focus flex min-w-0 flex-1 items-center gap-2.5 rounded-xl text-left"
          >
            <ReciterAvatar reciter={reciter} size={42} className="rounded-xl" />
            <span className="min-w-0 flex-1 pr-1">
              <span className="block truncate text-[0.9375rem] font-semibold text-[var(--home-heading)]">
                {surah.englishName}
              </span>
              <span
                className={cn(
                  'block truncate text-[0.78125rem]',
                  error ? 'text-rose-600 dark:text-rose-400' : 'text-[var(--home-muted)]'
                )}
              >
                {error ?? reciter.name}
              </span>
            </span>
          </button>
          <SkipButton seconds={-SKIP_SECONDS} size={40} />
          <PlayPauseButton status={status} size={44} />
          <SkipButton seconds={SKIP_SECONDS} size={40} />
        </div>
      </div>
    </div>
  )
}

function Progress() {
  const { position, duration } = useListenProgress()
  const played = duration ? Math.min(100, (position / duration) * 100) : 0
  return (
    <div className="h-[2.5px] bg-[var(--home-track)]" aria-hidden>
      <div className="h-full bg-[var(--home-sage)] transition-[width] duration-300 ease-linear" style={{ width: `${played}%` }} />
    </div>
  )
}
