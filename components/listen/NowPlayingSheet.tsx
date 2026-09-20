'use client'

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, ChevronRight, Download, Mic, Moon, Square } from 'lucide-react'
import DownloadButton, { DownloadRing } from '@/components/listen/DownloadButton'
import HeartButton from '@/components/listen/HeartButton'
import ReciterAvatar from '@/components/listen/ReciterAvatar'
import { PlayPauseButton, SkipButton } from '@/components/listen/PlayerControls'
import { SleepLeft, turnOffSleep, turnOnSleep } from '@/components/listen/SleepControls'
import Switch from '@/components/qari/Switch'
import { useListenProgress, useListenState, useSurahDownload } from '@/hooks/useListen'
import { tapFeedback } from '@/lib/haptics'
import {
  SKIP_SECONDS,
  formatClock,
  lastSleepChoice,
  seekTo,
  stopListening,
} from '@/lib/listen-player'
import { getQiraat, getReciterById, narrationChoices, type Reciter } from '@/lib/reciters'
import type { Chapter } from '@/types'
import { useT } from '@/lib/i18n'

const CLOSE_MS = 260

/**
 * The player, full screen. It rises from the bar at the bottom and can be
 * pulled back down by its top edge.
 */
export default function NowPlayingSheet({
  open,
  onClose,
  onOpenSleep,
  onOpenNarration,
}: {
  open: boolean
  onClose: () => void
  onOpenSleep: () => void
  onOpenNarration: () => void
}) {
  const t = useT()
  const { surah, reciterId, status, error } = useListenState()
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

  useEffect(() => () => window.clearTimeout(closeTimer.current), [])

  useEffect(() => {
    if (!open) return
    setDrag(0)
    setClosing(false)
    setArt(Math.round(Math.max(168, Math.min(264, window.innerHeight * 0.31))))
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      // A sheet opened over the player closes first.
      if (e.key === 'Escape' && document.querySelectorAll('[role="dialog"]').length === 1) dismiss()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
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
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={t('Now playing')}>
      <div
        className="listen-np-scrim absolute inset-0 bg-black/50"
        style={{
          opacity: closing ? 0 : Math.max(0, 1 - drag / 420),
          transition: dragging ? 'none' : `opacity ${CLOSE_MS}ms ease`,
        }}
        onClick={dismiss}
        aria-hidden
      />
      <div
        className="listen-np absolute inset-0 overflow-y-auto overscroll-contain bg-[var(--app-bg)]"
        style={{
          transform: `translateY(${offset})`,
          transition: settle,
          borderRadius: drag > 0 || closing ? '28px 28px 0 0' : undefined,
        }}
      >
        <div className="mx-auto flex min-h-full w-full max-w-lg flex-col px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(0.5rem,env(safe-area-inset-top))]">
          <div
            className="touch-none select-none pb-1"
            onPointerDown={grab}
            onPointerMove={move}
            onPointerUp={release}
            onPointerCancel={release}
          >
            <div className="mx-auto mb-3 mt-1.5 h-1 w-10 rounded-full bg-[var(--home-rule-strong)]" aria-hidden />
            <div className="flex items-center justify-between">
              <button type="button" onClick={dismiss} className="home-round ed-focus" aria-label={t('Close Now playing')}>
                <ChevronDown className="h-5 w-5" strokeWidth={1.9} />
              </button>
              <span className="home-label">{t('Now playing')}</span>
              <HeartButton reciter={reciter} size={42} iconSize={19} className="home-round" />
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

          <div className="home-card mt-7 overflow-hidden rounded-2xl">
            <SleepRow onOpen={onOpenSleep} />
            <div className="set-row__divider" aria-hidden />
            <NarrationRow reciter={reciter} onOpen={onOpenNarration} />
            <div className="set-row__divider" aria-hidden />
            <SaveRow reciterId={reciterId} surah={surah} />
            <div className="set-row__divider" aria-hidden />
            <button
              type="button"
              className="set-row"
              onClick={() => {
                tapFeedback()
                dismiss()
                window.setTimeout(stopListening, CLOSE_MS)
              }}
            >
              <span className="set-row__icon set-row__icon--neutral" aria-hidden>
                <Square className="h-[14px] w-[14px] fill-current" strokeWidth={0} />
              </span>
              <span className="set-row__label">{t('Stop listening')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

function SeekBar() {
  const t = useT()
  const { position, duration } = useListenProgress()
  const [scrub, setScrub] = useState<number | null>(null)
  const value = Math.min(scrub ?? position, duration || 0)
  const played = duration ? (value / duration) * 100 : 0

  const commit = () => {
    if (scrub === null) return
    seekTo(scrub)
    setScrub(null)
  }

  return (
    <div className="mt-5 px-1">
      <input
        type="range"
        min={0}
        max={duration || 1}
        step={1}
        value={value}
        disabled={!duration}
        onChange={(e) => setScrub(Number(e.target.value))}
        onPointerUp={commit}
        onKeyUp={commit}
        onBlur={commit}
        aria-label={t('Position in the surah')}
        aria-valuetext={`${formatClock(value)} of ${formatClock(duration)}`}
        className="listen-seek"
        style={{ ['--fill' as string]: `${played}%` }}
      />
      <div className="mt-0.5 flex justify-between text-[0.78125rem] font-medium tabular-nums text-[var(--home-muted)]">
        <span>{formatClock(value)}</span>
        <span>{duration ? formatClock(duration) : '--:--'}</span>
      </div>
    </div>
  )
}

function SleepRow({ onOpen }: { onOpen: () => void }) {
  const t = useT()
  const { sleep } = useListenState()
  return (
    <div className="set-row" style={{ paddingBlock: 9 }}>
      <button
        type="button"
        onClick={() => {
          tapFeedback()
          onOpen()
        }}
        className="ed-focus flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left"
      >
        <span className="set-row__icon" aria-hidden>
          <Moon className="h-[17px] w-[17px]" strokeWidth={1.9} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[0.9375rem] font-medium">{t('Sleep mode')}</span>
          <span className="mt-px block text-[0.78125rem] tabular-nums text-[var(--home-muted)]">
            {sleep ? <SleepLeft prefix={t('Stops in ')} fallback={t('Stops at the end of this surah')} /> : t('Off')}
          </span>
        </span>
      </button>
      <Switch
        checked={Boolean(sleep)}
        onChange={(on) => (on ? turnOnSleep(lastSleepChoice()) : turnOffSleep())}
        label={t('Sleep mode')}
      />
    </div>
  )
}

function NarrationRow({ reciter, onOpen }: { reciter: Reciter; onOpen: () => void }) {
  const t = useT()
  const short = getQiraat(reciter.qiraat).short
  const icon = (
    <span className="set-row__icon" aria-hidden>
      <Mic className="h-[17px] w-[17px]" strokeWidth={1.9} />
    </span>
  )
  if (narrationChoices(reciter).length < 2) {
    return (
      <div className="set-row">
        {icon}
        <span className="set-row__label">{t('Narration')}</span>
        <span className="set-row__value">{short}</span>
      </div>
    )
  }
  return (
    <button
      type="button"
      className="set-row"
      onClick={() => {
        tapFeedback()
        onOpen()
      }}
    >
      {icon}
      <span className="set-row__label">{t('Narration')}</span>
      <span className="set-row__value">{short}</span>
      <ChevronRight className="h-[17px] w-[17px] shrink-0 text-[var(--home-muted)]" strokeWidth={2} />
    </button>
  )
}

function SaveRow({ reciterId, surah }: { reciterId: string; surah: Chapter }) {
  const t = useT()
  const download = useSurahDownload(reciterId, surah.id)
  const icon = (
    <span className="set-row__icon" aria-hidden>
      <Download className="h-[17px] w-[17px]" strokeWidth={1.9} />
    </span>
  )

  if (download.state === 'done') {
    return (
      <div className="set-row">
        {icon}
        <span className="set-row__label">{t('Saved for offline')}</span>
        <Check className="h-[18px] w-[18px] shrink-0 text-[var(--home-sage-deep)]" strokeWidth={2.6} aria-label={t('Saved')} />
      </div>
    )
  }

  if (download.state !== 'none') {
    return (
      <div className="set-row">
        {icon}
        <span className="set-row__label">{download.state === 'queued' ? t('Waiting to save') : t('Saving for offline')}</span>
        <DownloadRing percent={download.percent} waiting={download.state === 'queued' || download.percent === 0} />
      </div>
    )
  }

  return (
    <div className="set-row" style={{ paddingRight: 6 }}>
      {icon}
      <span className="set-row__label">{t('Save for offline')}</span>
      <DownloadButton reciterId={reciterId} chapter={surah} />
    </div>
  )
}
