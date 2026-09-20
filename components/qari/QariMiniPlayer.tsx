'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { SkipForward } from 'lucide-react'
import PlayButton from '@/components/qari/PlayButton'
import QariAvatar from '@/components/qari/QariAvatar'
import { useQariPlayer } from '@/hooks/useQariPlayer'
import { tapFeedback } from '@/lib/haptics'
import { hasNextRecitation, pausePlayback, resumePlayback, skipToNextRecitation } from '@/lib/qari-player'
import { useT } from '@/lib/i18n'

/** Whether the card for this recitation is on screen, above the tab bar. */
function cardInView(id: string): boolean {
  const card = document.querySelector(`[data-recitation="${CSS.escape(id)}"]`)
  if (!card) return false
  const rect = card.getBoundingClientRect()
  return rect.bottom > 72 && rect.top < window.innerHeight - 150
}

/**
 * Playing, but its card has scrolled away or belongs to another screen: the
 * player waits above the tab bar. Tap it to go back to the card.
 */
export default function QariMiniPlayer() {
  const t = useT()
  const player = useQariPlayer()
  const router = useRouter()
  const current = player.current
  const [hidden, setHidden] = useState(true)

  useEffect(() => {
    if (!current) return
    let frame = 0
    const check = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => setHidden(cardInView(current.id)))
    }
    check()
    // Lists load and change under the player, so look again now and then too.
    const interval = window.setInterval(check, 700)
    window.addEventListener('scroll', check, { passive: true })
    window.addEventListener('resize', check)
    return () => {
      cancelAnimationFrame(frame)
      window.clearInterval(interval)
      window.removeEventListener('scroll', check)
      window.removeEventListener('resize', check)
    }
  }, [current])

  const showing = Boolean(current && !hidden)

  // Messages sit above the player instead of behind it.
  useEffect(() => {
    document.documentElement.style.setProperty('--toast-lift', showing ? '9.5rem' : '4.5rem')
    return () => {
      document.documentElement.style.removeProperty('--toast-lift')
    }
  }, [showing])

  if (!current || !showing) return null

  const played = player.duration > 0 ? Math.min(100, (player.position / player.duration) * 100) : 0
  const active = player.status === 'playing' || player.status === 'loading'

  const goToCard = () => {
    tapFeedback()
    const card = document.querySelector(`[data-recitation="${CSS.escape(current.id)}"]`)
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' })
    else router.push(`/qari/${encodeURIComponent(current.userUsername)}`)
  }

  return (
    <div className="listen-mini fixed inset-x-0 z-40 px-3" style={{ bottom: 'calc(4.75rem + env(safe-area-inset-bottom))' }}>
      <div className="listen-float mx-auto max-w-lg overflow-hidden rounded-[18px]">
        <div className="h-[2.5px] bg-[var(--home-track)]" aria-hidden>
          <div
            className="h-full bg-[var(--home-sage)] transition-[width] duration-300 ease-linear"
            style={{ width: `${played}%` }}
          />
        </div>
        <div className="flex items-center gap-1 py-2 pl-2.5 pr-1.5">
          <button
            type="button"
            onClick={goToCard}
            aria-label={t('Go to {title}', { title: current.title })}
            className="ed-focus flex min-w-0 flex-1 items-center gap-2.5 rounded-xl text-left"
          >
            <QariAvatar username={current.userUsername} name={current.userName} size={38} />
            <span className="min-w-0 flex-1 pr-1">
              <span className="block truncate text-[14.5px] font-semibold text-[var(--home-heading)]">
                {current.title}
              </span>
              <span className="block truncate text-xs text-[var(--home-muted)]">{current.userName}</span>
            </span>
          </button>
          <PlayButton
            status={player.status}
            size={40}
            label={current.title}
            onClick={() => {
              tapFeedback()
              if (active) pausePlayback()
              else resumePlayback()
            }}
          />
          <button
            type="button"
            disabled={!hasNextRecitation()}
            onClick={() => {
              tapFeedback()
              skipToNextRecitation()
            }}
            aria-label={t('Next recitation')}
            className="qari-press ed-focus flex h-10 w-10 items-center justify-center rounded-full text-[var(--home-heading)] disabled:opacity-30"
          >
            <SkipForward className="h-[18px] w-[18px] fill-current" strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  )
}
