'use client'

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Languages } from 'lucide-react'
import { NatureChip } from '@/components/listen/NatureControls'
import { SeekBar, SleepTopButton } from '@/components/listen/NowPlayingParts'
import ReciterAvatar from '@/components/listen/ReciterAvatar'
import { PlayPauseButton, SkipButton } from '@/components/listen/PlayerControls'
import VideoMode from '@/components/listen/VideoMode'
import { useListenState } from '@/hooks/useListen'
import { tapFeedback } from '@/lib/haptics'
import { SKIP_SECONDS } from '@/lib/listen-player'
import { isListenVideoOn, setListenVideo, subscribeListenVideo } from '@/lib/listen-video'
import { getQiraat, getReciterById } from '@/lib/reciters'
import { BOTTOM_NAV_HEIGHT_REM } from '@/lib/bottom-nav'
import { useT } from '@/lib/i18n'
import { useCloseOnBack } from '@/lib/native-back'
import { lockPageScroll } from '@/lib/scroll-lock'

const CLOSE_MS = 260
/** Stops above the bottom tab bar, which Listen always shows, rather than covering it. */
const SHEET_BOTTOM = `calc(${BOTTOM_NAV_HEIGHT_REM}rem + env(safe-area-inset-bottom))`

/**
 * The player, full screen. It rises from the bar at the bottom and can be
 * pulled back down by its top edge.
 */
export default function NowPlayingSheet({
  open,
  onClose,
  onOpenSleep,
  onOpenNature,
}: {
  open: boolean
  onClose: () => void
  onOpenSleep: () => void
  onOpenNature: () => void
}) {
  const t = useT()
  const { surah, reciterId, status, error } = useListenState()
  const video = useSyncExternalStore(subscribeListenVideo, isListenVideoOn, () => false)
  const [drag, setDrag] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [closing, setClosing] = useState(false)
  const [art, setArt] = useState(232)
  const start = useRef<{ y: number; t: number } | null>(null)
  const closeTimer = useRef<number | undefined>(undefined)

  const dismiss = useCallback(() => {
    setClosing(true)
    window.clearTimeout(closeTimer.current)
    closeTimer.current = window.setTimeout(() => {
      setClosing(false)
      setDrag(0)
      onClose()
    }, CLOSE_MS)
  }, [onClose])
  useCloseOnBack(open, dismiss)

  useEffect(() => () => window.clearTimeout(closeTimer.current), [])

  useEffect(() => {
    if (!open) return
    setDrag(0)
    setClosing(false)
    setArt(Math.round(Math.max(168, Math.min(264, window.innerHeight * 0.31))))
    const unlockScroll = lockPageScroll()
    const onKey = (e: KeyboardEvent) => {
      // A sheet opened over the player closes first.
      if (e.key === 'Escape' && document.querySelectorAll('[role="dialog"]').length === 1) dismiss()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      unlockScroll()
      window.removeEventListener('keydown', onKey)
    }
  }, [open, dismiss])

  // Stopped from somewhere else, such as the lock screen: nothing left to show.
  useEffect(() => {
    if (open && !surah) onClose()
  }, [open, surah, onClose])

  if (!open || !surah || !reciterId || typeof document === 'undefined') return null
  const reciter = getReciterById(reciterId)

  const grab = (e: ReactPointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return
    start.current = { y: e.clientY, t: performance.now() }
    setDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (start.current) setDrag(Math.max(0, e.clientY - start.current.y))
  }
  const release = (e: ReactPointerEvent<HTMLDivElement>) => {
    const from = start.current
    start.current = null
    setDragging(false)
    if (!from) return
    const distance = Math.max(0, e.clientY - from.y)
    const speed = distance / Math.max(1, performance.now() - from.t)
    if (distance > 120 || (distance > 36 && speed > 0.6)) dismiss()
    else setDrag(0)
  }

  const offset = closing ? '100%' : `${drag}px`
  const settle = dragging ? 'none' : `transform ${CLOSE_MS}ms cubic-bezier(0.2, 0.8, 0.25, 1)`

  return createPortal(
    <div
      className="fixed inset-x-0 top-0 z-40"
      style={{ bottom: SHEET_BOTTOM }}
      role="dialog"
      aria-modal="true"
      aria-label={t('Now playing')}
    >
      <div
        className="listen-np-scrim absolute inset-0 bg-black/50"
        style={{
          opacity: closing ? 0 : Math.max(0, 1 - drag / 420),
          transition: dragging ? 'none' : `opacity ${CLOSE_MS}ms ease`,
        }}
        onClick={dismiss}
        aria-hidden
      />
      {/* Solid behind the see-through tab bar, so the list does not show under it. */}
      <div
        className="absolute inset-x-0 bg-[var(--app-bg)]"
        style={{
          top: '100%',
          height: SHEET_BOTTOM,
          opacity: closing ? 0 : 1,
          transition: `opacity ${CLOSE_MS}ms ease`,
        }}
        aria-hidden
      />
      <div
        className="listen-np absolute inset-0 overflow-y-auto overscroll-contain bg-[var(--app-bg)]"
        style={{
          transform: `translateY(${offset})`,
          transition: settle,
          // Square where it meets the tab bar, so nothing shows through at its corners;
          // dragging it down rounds the top.
          borderRadius: drag > 0 || closing ? '28px 28px 0 0' : 0,
        }}
      >
        <div className="mx-auto flex min-h-full w-full max-w-lg flex-col px-4 pb-6 pt-[max(0.5rem,env(safe-area-inset-top))]">
          <div
            className="touch-none select-none pb-1"
            onPointerDown={grab}
            onPointerMove={move}
            onPointerUp={release}
            onPointerCancel={release}
          >
            <div className="mx-auto mb-3 mt-1.5 h-1 w-10 rounded-full bg-[var(--home-rule-strong)]" aria-hidden />
            {/* Three columns, so Nature mode stays centred however wide the sleep button grows. */}
            <div className="grid grid-cols-[1fr_auto_1fr] items-center">
              <button type="button" onClick={dismiss} className="home-round ed-focus justify-self-start" aria-label={t('Close Now playing')}>
                <ChevronDown className="h-5 w-5" strokeWidth={1.9} />
              </button>
              <NatureChip onOpen={onOpenNature} />
              <span className="justify-self-end">
                <SleepTopButton onOpen={onOpenSleep} />
              </span>
            </div>

            <div className="mt-6 flex justify-center">
              <ReciterAvatar
                key={reciter.id}
                reciter={reciter}
                size={art}
                square
                className="home-fade shadow-[0_24px_48px_-24px_rgba(0,0,0,0.55)]"
              />
            </div>
          </div>

          <div className="mt-5 text-center">
            <h2 className="home-serif text-[1.875rem] font-semibold leading-tight tracking-[-0.02em] text-[var(--home-heading)]">
              {surah.englishName}
            </h2>
            <p className="amiri !text-center mt-0.5 text-[1.3125rem] leading-normal text-[var(--home-sage-deep)]" lang="ar">
              {surah.name}
            </p>
            <p className="mt-0.5 text-sm text-[var(--home-muted)]">
              {reciter.name} · {getQiraat(reciter.qiraat).short}
            </p>
            {error ? (
              <p className="qari-enter mt-2 text-sm font-medium text-rose-600 dark:text-rose-400" role="alert">
                {error}
              </p>
            ) : null}
          </div>

          <SeekBar />

          <div className="mt-2.5 flex items-center justify-center gap-6">
            <SkipButton seconds={-SKIP_SECONDS} size={58} raised />
            <PlayPauseButton status={status} size={78} className="shadow-[0_16px_32px_-14px_rgba(0,0,0,0.55)]" />
            <SkipButton seconds={SKIP_SECONDS} size={58} raised />
          </div>

          <div className="mt-7 flex justify-center">
            <button
              type="button"
              onClick={() => {
                tapFeedback()
                setListenVideo(true)
              }}
              className="fx-press ed-focus inline-flex h-10 items-center gap-2 rounded-full bg-[var(--home-card-bg)] pl-3.5 pr-4 text-[0.875rem] font-semibold text-[var(--home-heading)] shadow-[var(--home-lift-sm)]"
            >
              <Languages className="h-[17px] w-[17px]" strokeWidth={2} aria-hidden />
              {t('Translation mode')}
            </button>
          </div>
        </div>
      </div>
      {/* Full screen over everything, the tab bar too (it portals itself to the page). */}
      {video ? <VideoMode onClose={onClose} onOpenSleep={onOpenSleep} onOpenNature={onOpenNature} /> : null}
    </div>,
    document.body
  )
}
