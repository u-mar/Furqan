'use client'

import { useEffect } from 'react'
import ReciterAvatar from '@/components/listen/ReciterAvatar'
import { SkipForward } from 'lucide-react'
import { PlayPauseButton } from '@/components/listen/PlayerControls'
import { useListenProgress, useListenState } from '@/hooks/useListen'
import { BOTTOM_NAV_HEIGHT_REM } from '@/lib/bottom-nav'
import { cn } from '@/lib/cn'
import { tapFeedback } from '@/lib/haptics'
import { playNeighbour } from '@/lib/listen-player'
import { getReciterById } from '@/lib/reciters'
import { useT } from '@/lib/i18n'

/** Floats just above the bottom tab bar, on Listen and on Home. */
const MINI_PLAYER_BOTTOM = `calc(${BOTTOM_NAV_HEIGHT_REM}rem + env(safe-area-inset-bottom) + 0.5rem)`

/**
 * The player along the bottom: a slim grey pill with the reciter's photo, the
 * surah, the next surah and a white play button, and a thin line along its foot
 * for how far the surah has played. Tap it for Now playing, which has the rest.
 */
export default function MiniPlayer({ onOpen, whilePlaying = false }: { onOpen: () => void; whilePlaying?: boolean }) {
  const t = useT()
  const { surah, reciterId, status, error } = useListenState()
  // On Home it shows only while something plays: it rises with Continue
  // listening and goes once the recitation is paused or stopped.
  const showing = Boolean(surah && reciterId) && (!whilePlaying || status === 'playing' || status === 'loading')

  // The screen leaves room for it, and messages sit above it.
  useEffect(() => {
    if (!showing) return
    const root = document.documentElement.style
    root.setProperty('--toast-lift', '10rem')
    root.setProperty('--listen-dock', '4.5rem')
    return () => {
      root.removeProperty('--toast-lift')
      root.removeProperty('--listen-dock')
    }
  }, [showing])

  if (!showing || !surah || !reciterId) return null
  const reciter = getReciterById(reciterId)

  return (
    <div className="listen-mini fixed inset-x-0 z-40 px-3" style={{ bottom: MINI_PLAYER_BOTTOM }}>
      <div className="listen-card relative mx-auto flex max-w-lg items-center gap-2 overflow-hidden rounded-full py-1.5 pb-2 pe-1.5 ps-1.5">
        <button
          type="button"
          onClick={onOpen}
          aria-label={t('Open Now playing: {englishName}', { englishName: surah.englishName })}
          className="ed-focus flex min-w-0 flex-1 items-center gap-3 rounded-full text-left"
        >
          <ReciterAvatar reciter={reciter} size={44} />
          <span className="min-w-0 flex-1 pr-1">
            <span className="block truncate text-[0.96875rem] font-semibold text-[var(--home-heading)]">{surah.englishName}</span>
            <span
              className={cn(
                'block truncate text-[0.8125rem]',
                error ? 'text-rose-600 dark:text-rose-400' : 'text-[var(--home-muted)]'
              )}
            >
              {error ?? reciter.name}
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => {
            tapFeedback()
            void playNeighbour(1)
          }}
          aria-label={t('Next surah')}
          className="ed-focus fx-press flex h-[2.625rem] w-[2.625rem] shrink-0 items-center justify-center rounded-full text-[var(--home-muted)]"
        >
          <SkipForward className="h-[21px] w-[21px] fill-current rtl:-scale-x-100" strokeWidth={1.6} />
        </button>
        <PlayPauseButton status={status} size={42} />
        <Progress />
      </div>
    </div>
  )
}

/** A thin line along the pill's foot: how far the surah has played. */
function Progress() {
  const { position, duration } = useListenProgress()
  const played = duration ? Math.min(100, (position / duration) * 100) : 0
  return (
    <div className="absolute inset-x-6 bottom-[3px] h-[2px] overflow-hidden rounded-full bg-[var(--home-track)]" aria-hidden>
      <div className="h-full rounded-full bg-white transition-[width] duration-300 ease-linear" style={{ width: `${played}%` }} />
    </div>
  )
}
