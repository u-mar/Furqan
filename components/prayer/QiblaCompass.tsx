'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Compass } from 'lucide-react'
import { successFeedback } from '@/lib/haptics'
import { distanceToKaabaKm, qiblaBearing, type Place } from '@/lib/prayer'
import { useT } from '@/lib/i18n'

type Sensor = 'unknown' | 'needs-permission' | 'running' | 'unavailable' | 'denied'

interface OrientationEvent extends DeviceOrientationEvent {
  /** iPhone only: degrees clockwise from magnetic north. */
  webkitCompassHeading?: number
}

type PermissionedOrientation = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<'granted' | 'denied'> }

/** Within this many degrees of the qibla counts as facing it. */
const FACING_DEG = 4

const norm = (deg: number) => ((deg % 360) + 360) % 360
/** Shortest signed turn from a to b, in degrees. */
const turn = (a: number, b: number) => ((b - a + 540) % 360) - 180

/**
 * A compass that shows which way the qibla is. The dial turns with the phone so
 * north stays north, the Kaaba marker sits at its true bearing, and the top of
 * the phone is the fixed pointer: turn until the marker is under it.
 *
 * Phones keep their compass behind a permission (iPhones ask on a tap), and
 * computers have none, so without one the dial simply shows the bearing.
 */
export default function QiblaCompass({ place }: { place: Place }) {
  const t = useT()
  const bearing = qiblaBearing(place)
  const km = Math.round(distanceToKaabaKm(place))
  const [sensor, setSensor] = useState<Sensor>('unknown')
  const [heading, setHeading] = useState<number | null>(null)
  const smooth = useRef<number | null>(null)
  const wasFacing = useRef(false)

  const onOrientation = useCallback((e: Event) => {
    const ev = e as OrientationEvent
    let raw: number | null = null
    if (typeof ev.webkitCompassHeading === 'number') raw = ev.webkitCompassHeading
    else if (ev.absolute && typeof ev.alpha === 'number') raw = norm(360 - ev.alpha)
    else if (typeof ev.alpha === 'number' && e.type === 'deviceorientationabsolute') raw = norm(360 - ev.alpha)
    if (raw === null) return
    // A little smoothing, taking the short way round north so the dial never spins.
    const previous = smooth.current
    const next = previous === null ? raw : norm(previous + turn(previous, raw) * 0.25)
    smooth.current = next
    setHeading(next)
  }, [])

  const listen = useCallback(() => {
    window.addEventListener('deviceorientationabsolute', onOrientation as EventListener, true)
    window.addEventListener('deviceorientation', onOrientation as EventListener, true)
    setSensor('running')
  }, [onOrientation])

  // Where no permission is needed the compass can start at once.
  useEffect(() => {
    if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) {
      setSensor('unavailable')
      return
    }
    const needsPermission = typeof (DeviceOrientationEvent as PermissionedOrientation).requestPermission === 'function'
    if (needsPermission) setSensor('needs-permission')
    else listen()
    return () => {
      window.removeEventListener('deviceorientationabsolute', onOrientation as EventListener, true)
      window.removeEventListener('deviceorientation', onOrientation as EventListener, true)
    }
  }, [listen, onOrientation])

  // No reading after a moment means a computer, or a phone without a compass.
  useEffect(() => {
    if (sensor !== 'running') return
    const id = window.setTimeout(() => {
      if (smooth.current === null) setSensor('unavailable')
    }, 2500)
    return () => window.clearTimeout(id)
  }, [sensor])

  const enable = async () => {
    try {
      const result = await (DeviceOrientationEvent as PermissionedOrientation).requestPermission?.()
      if (result === 'granted') listen()
      else setSensor('denied')
    } catch {
      setSensor('denied')
    }
  }

  const facing = heading !== null && Math.abs(turn(heading, bearing)) <= FACING_DEG
  useEffect(() => {
    if (facing && !wasFacing.current) successFeedback()
    wasFacing.current = facing
  }, [facing])

  const dialTurn = heading === null ? 0 : -heading

  return (
    <div className="flex flex-col items-center">
      <div className="relative mt-2 aspect-square w-full max-w-[19rem]">
        {/* Fixed pointer: where the top of the phone points. */}
        <span
          className={`absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1 border-x-[9px] border-t-[14px] border-x-transparent transition-colors ${
            facing ? 'border-t-[var(--home-sage)]' : 'border-t-[var(--home-heading)]'
          }`}
          aria-hidden
        />
        <svg
          viewBox="0 0 200 200"
          className="h-full w-full transition-transform duration-150 ease-out"
          style={{ transform: `rotate(${dialTurn}deg)` }}
          role="img"
          aria-label={t('Compass showing the qibla, {degrees} degrees from north', { degrees: Math.round(bearing) })}
        >
          <circle cx="100" cy="100" r="96" fill="var(--home-card-bg)" stroke="var(--home-rule-strong)" strokeWidth="1.5" />
          <circle cx="100" cy="100" r="78" fill="none" stroke="var(--home-rule)" strokeWidth="1" />
          {Array.from({ length: 72 }, (_, i) => {
            const major = i % 6 === 0
            return (
              <line
                key={i}
                x1="100"
                y1="6"
                x2="100"
                y2={major ? 17 : 11}
                stroke="var(--home-muted)"
                strokeOpacity={major ? 0.9 : 0.45}
                strokeWidth={major ? 1.6 : 1}
                transform={`rotate(${i * 5} 100 100)`}
              />
            )
          })}
          {/* North, in red, then the other three. */}
          <text x="100" y="36" textAnchor="middle" fontSize="13" fontWeight="700" fill="#e11d48">N</text>
          <text x="164" y="105" textAnchor="middle" fontSize="11" fill="var(--home-muted)">E</text>
          <text x="100" y="176" textAnchor="middle" fontSize="11" fill="var(--home-muted)">S</text>
          <text x="36" y="105" textAnchor="middle" fontSize="11" fill="var(--home-muted)">W</text>

          {/* The qibla: a line to the Kaaba at its bearing. */}
          <g transform={`rotate(${bearing} 100 100)`}>
            <line x1="100" y1="100" x2="100" y2="50" stroke="var(--home-sage)" strokeWidth="3" strokeLinecap="round" />
            <rect x="88" y="26" width="24" height="24" rx="4" fill="#111" stroke="#c9a24d" strokeWidth="2" />
            <rect x="88" y="33" width="24" height="3.4" fill="#c9a24d" />
            <circle cx="100" cy="100" r="5" fill="var(--home-heading)" />
          </g>
        </svg>
      </div>

      <p
        className={`home-serif mt-5 text-[2.25rem] font-semibold leading-none tabular-nums ${
          facing ? 'text-[var(--home-sage-deep)]' : 'text-[var(--home-heading)]'
        }`}
      >
        {Math.round(bearing)}°
      </p>
      <p className="mt-1.5 text-center text-[0.875rem] text-[var(--home-muted)]" aria-live="polite">
        {facing
          ? t('You are facing the qibla')
          : sensor === 'running' && heading !== null
            ? t('Turn until the Kaaba is at the top')
            : t('The Kaaba is {degrees}° from north', { degrees: Math.round(bearing) })}
      </p>
      <p className="mt-0.5 text-[0.78125rem] text-[var(--home-muted)]">{t('{km} km to the Kaaba', { km: km.toLocaleString() })}</p>

      {sensor === 'needs-permission' ? (
        <button
          type="button"
          onClick={() => void enable()}
          className="ed-ink ed-focus qari-press mt-5 flex h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold"
        >
          <Compass className="h-4 w-4" strokeWidth={2} />
          {t('Turn on the compass')}
        </button>
      ) : null}
      {sensor === 'denied' ? (
        <p className="mt-4 max-w-[26ch] text-center text-xs text-[var(--home-muted)]">
          {t('The compass is off. Allow motion and orientation for this app in your phone’s settings.')}
        </p>
      ) : null}
      {sensor === 'unavailable' ? (
        <p className="mt-4 max-w-[28ch] text-center text-xs text-[var(--home-muted)]">
          {t('No compass on this device. Hold a phone with a compass level, or use the bearing above.')}
        </p>
      ) : null}
    </div>
  )
}
