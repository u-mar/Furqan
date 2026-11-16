'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Pause, Play, Scissors } from 'lucide-react'
import SettingsSheet from '@/components/settings/SettingsSheet'
import { tapFeedback } from '@/lib/haptics'
import { formatDuration } from '@/lib/qari'
import { MIN_TRIM_SECONDS, trimRecording } from '@/lib/qari-trim'
import { useT } from '@/lib/i18n'

/**
 * Cut the start and the end off a recording before it is posted: two handles over its shape,
 * the part that stays lit and the parts that go dimmed. "Listen" plays only what stays.
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
  const [from, setFrom] = useState(0)
  const [to, setTo] = useState(durationSec)
  const [playing, setPlaying] = useState(false)
  const [working, setWorking] = useState<number | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const bounds = useRef({ from: 0, to: durationSec })
  bounds.current = { from, to }

  const url = useMemo(() => (open ? URL.createObjectURL(blob) : null), [open, blob])
  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [url])

  // Each time it opens: the whole recording, nothing playing.
  useEffect(() => {
    if (!open) return
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
    audio.currentTime = from
    void audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false))
  }

  const apply = async () => {
    if (working !== null) return
    tapFeedback()
    stop()
    setWorking(0)
    try {
      onTrimmed(await trimRecording(blob, from, to, setWorking))
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
  const kept = Math.max(0, to - from)
  const changed = from > 0.05 || to < durationSec - 0.05
  const step = durationSec > 120 ? 0.5 : 0.1

  return (
    <SettingsSheet open={open} title={t('Trim')} description={t('Cut the start or the end. Drag the two handles to what you want to keep.')} onClose={onClose}>
      {url ? (
        <audio
          ref={audioRef}
          src={url}
          preload="auto"
          onTimeUpdate={(e) => {
            if (e.currentTarget.currentTime >= bounds.current.to) stop()
          }}
          onEnded={() => setPlaying(false)}
        />
      ) : null}

      <div className="trim-wave" dir="ltr">
        <div className="trim-wave__bars" aria-hidden>
          {shape.map((height, i) => {
            const at = ((i + 0.5) / bars) * durationSec
            return <span key={i} className={at >= from && at <= to ? 'is-kept' : undefined} style={{ height: `${height}%` }} />
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
            setFrom(Math.min(Number(e.target.value), to - MIN_TRIM_SECONDS))
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
            setTo(Math.max(Number(e.target.value), from + MIN_TRIM_SECONDS))
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
              {t('Trim')}
            </>
          )}
        </button>
      </div>
    </SettingsSheet>
  )
}
