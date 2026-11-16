'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Pause, Play, Scissors } from 'lucide-react'
import SettingsSheet from '@/components/settings/SettingsSheet'
import { tapFeedback } from '@/lib/haptics'
import { formatDuration } from '@/lib/qari'
import { MIN_TRIM_SECONDS, cutOutOfRecording, trimRecording } from '@/lib/qari-trim'
import { cn } from '@/lib/cn'
import { useT } from '@/lib/i18n'

/** Keep what is between the handles (cutting the start and end), or take that part out of the middle. */
type Mode = 'keep' | 'remove'
/** Listening to a middle cut: this much before it and after it, so the join is heard. */
const AROUND_CUT_S = 3

/**
 * Cut a recording before it is posted: two handles over its shape. "Ends" keeps what is between
 * them and drops the start and the end; "Middle" takes what is between them out and joins the
 * rest. The part that stays is lit, the part that goes dimmed, and "Listen" plays what stays.
 */
export default function TrimSheet({
  open,
  blob,
  durationSec,
  peaks,
  onClose,
  onTrimmed,
  onFailed,
}: {
  open: boolean
  blob: Blob
  durationSec: number
  peaks: number[]
  onClose: () => void
  onTrimmed: (result: { blob: Blob; mimeType: string; durationSec: number }) => void
  onFailed: () => void
}) {
  const t = useT()
  const [mode, setMode] = useState<Mode>('keep')
  const [from, setFrom] = useState(0)
  const [to, setTo] = useState(durationSec)
  const [playing, setPlaying] = useState(false)
  const [working, setWorking] = useState<number | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const bounds = useRef({ from: 0, to: durationSec, mode: 'keep' as Mode, jumped: false })
  bounds.current = { ...bounds.current, from, to, mode }

  const url = useMemo(() => (open ? URL.createObjectURL(blob) : null), [open, blob])
  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [url])

  // Each time it opens: the whole recording, nothing playing.
  useEffect(() => {
    if (!open) return
    setMode('keep')
    setFrom(0)
    setTo(durationSec)
    setPlaying(false)
    setWorking(null)
  }, [open, durationSec])

  useEffect(() => {
    if (!open) audioRef.current?.pause()
  }, [open])

  const stop = () => {
    audioRef.current?.pause()
    setPlaying(false)
  }

  const listen = () => {
    tapFeedback()
    const audio = audioRef.current
    if (!audio) return
    if (playing) return stop()
    // A middle cut is heard from a little before it, over the join, to a little after.
    bounds.current.jumped = false
    audio.currentTime = mode === 'keep' ? from : Math.max(0, from - AROUND_CUT_S)
    void audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false))
  }

  const apply = async () => {
    if (working !== null) return
    tapFeedback()
    stop()
    setWorking(0)
    try {
      onTrimmed(await (mode === 'keep' ? trimRecording : cutOutOfRecording)(blob, from, to, setWorking))
      onClose()
    } catch {
      setWorking(null)
      onFailed()
    }
  }

  const bars = 64
  const shape = useMemo(() => {
    if (peaks.length === 0) return Array.from({ length: bars }, () => 30)
    return Array.from({ length: bars }, (_, i) => {
      const a = Math.floor((i / bars) * peaks.length)
      const b = Math.max(a + 1, Math.floor(((i + 1) / bars) * peaks.length))
      return Math.max(8, ...peaks.slice(a, b))
    })
  }, [peaks])
  const kept = mode === 'keep' ? Math.max(0, to - from) : Math.max(0, durationSec - (to - from))
  const changed = mode === 'keep' ? from > 0.05 || to < durationSec - 0.05 : to - from > 0.05 && kept >= MIN_TRIM_SECONDS

  /** The other way of cutting, with the handles put where it starts: the whole of it, or its middle third. */
  const choose = (next: Mode) => {
    if (next === mode) return
    tapFeedback()
    stop()
    setMode(next)
    setFrom(next === 'keep' ? 0 : durationSec / 3)
    setTo(next === 'keep' ? durationSec : (durationSec * 2) / 3)
  }
  const step = durationSec > 120 ? 0.5 : 0.1

  return (
    <SettingsSheet open={open} title={t('Trim')} description={mode === 'keep' ? t('Cut the start or the end. Drag the two handles to what you want to keep.') : t('Take a part out of the middle. Drag the two handles around what you want to remove.')} onClose={onClose}>
      {url ? (
        <audio
          ref={audioRef}
          src={url}
          preload="auto"
          onTimeUpdate={(e) => {
            const at = e.currentTarget.currentTime
            const now = bounds.current
            if (now.mode === 'keep') {
              if (at >= now.to) stop()
            } else if (!now.jumped && at >= now.from) {
              now.jumped = true
              e.currentTarget.currentTime = now.to
            } else if (now.jumped && at >= now.to + AROUND_CUT_S) {
              stop()
            }
          }}
          onEnded={() => setPlaying(false)}
        />
      ) : null}

      <div className="ed-seg mb-3 grid-cols-2" role="radiogroup" aria-label={t('What to cut')}>
        {(
          [
            { id: 'keep', label: t('Start and end') },
            { id: 'remove', label: t('Middle') },
          ] as { id: Mode; label: string }[]
        ).map((option) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={mode === option.id}
            aria-pressed={mode === option.id}
            onClick={() => choose(option.id)}
            className="ed-seg__item ed-focus flex min-h-[40px] items-center justify-center text-[0.875rem] font-semibold"
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className={cn('trim-wave', mode === 'remove' && 'is-removing')} dir="ltr">
        <div className="trim-wave__bars" aria-hidden>
          {shape.map((height, i) => {
            const at = ((i + 0.5) / bars) * durationSec
            return <span key={i} className={(at >= from && at <= to) === (mode === 'keep') ? 'is-kept' : undefined} style={{ height: `${height}%` }} />
          })}
        </div>
        <input
          type="range"
          min={0}
          max={durationSec}
          step={step}
          value={from}
          onChange={(e) => {
            stop()
            setFrom(Math.min(Number(e.target.value), to - (mode === 'keep' ? MIN_TRIM_SECONDS : 0.3)))
          }}
          aria-label={t('Start')}
          className="trim-range"
        />
        <input
          type="range"
          min={0}
          max={durationSec}
          step={step}
          value={to}
          onChange={(e) => {
            stop()
            setTo(Math.max(Number(e.target.value), from + (mode === 'keep' ? MIN_TRIM_SECONDS : 0.3)))
          }}
          aria-label={t('End')}
          className="trim-range"
        />
      </div>

      <div className="mt-2 flex justify-between text-[0.78125rem] font-medium tabular-nums text-[var(--home-muted)]" dir="ltr">
        <span>{formatDuration(from)}</span>
        <span className="font-semibold text-[var(--home-heading)]">{t('Keeps {length}', { length: formatDuration(kept) })}</span>
        <span>{formatDuration(to)}</span>
      </div>

      <div className="mt-5 flex gap-2.5">
        <button
          type="button"
          onClick={listen}
          disabled={working !== null}
          className="fx-press ed-focus flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-[color-mix(in_srgb,var(--home-heading)_10%,transparent)] text-[0.9375rem] font-semibold text-[var(--home-heading)] disabled:opacity-50"
        >
          {playing ? <Pause className="h-4 w-4 fill-current" strokeWidth={0} /> : <Play className="h-4 w-4 fill-current" strokeWidth={0} />}
          {playing ? t('Pause') : t('Listen')}
        </button>
        <button
          type="button"
          onClick={() => void apply()}
          disabled={!changed || working !== null}
          className="fx-press ed-focus flex h-12 flex-[1.4] items-center justify-center gap-2 rounded-full bg-[var(--home-heading)] text-[0.9375rem] font-semibold text-[var(--app-bg)] disabled:opacity-40"
        >
          {working !== null ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.4} />
              {Math.round(working * 100)}%
            </>
          ) : (
            <>
              <Scissors className="h-4 w-4" strokeWidth={2.2} />
              {mode === 'keep' ? t('Trim') : t('Cut out')}
            </>
          )}
        </button>
      </div>
    </SettingsSheet>
  )
}
