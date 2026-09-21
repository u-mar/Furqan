'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Compass } from 'lucide-react'
import geomagnetism from 'geomagnetism'
import { successFeedback } from '@/lib/haptics'
import { distanceToKaabaKm, qiblaBearing, type Place } from '@/lib/prayer'
import { useT } from '@/lib/i18n'

type Sensor = 'unknown' | 'needs-permission' | 'running' | 'unavailable' | 'denied'

interface OrientationEvent extends DeviceOrientationEvent {
  /** iPhone only: degrees clockwise from magnetic north. */
  webkitCompassHeading?: number
  /** iPhone only: how far off that reading may be, in degrees; negative when it cannot say. */
  webkitCompassAccuracy?: number
}

type PermissionedOrientation = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<'granted' | 'denied'> }

/** Within this many degrees of the qibla counts as facing it. */
const FACING_DEG = 3
/** A reading this loose needs the phone waved in a figure of eight. */
const POOR_ACCURACY_DEG = 25

const norm = (deg: number) => ((deg % 360) + 360) % 360
/** Shortest signed turn from a to b, in degrees. */
const turn = (a: number, b: number) => ((b - a + 540) % 360) - 180

/** The Kaaba, drawn as the cube it is: black cloth, a gold band, a gold door. */
function Kaaba({ x, y, size }: { x: number; y: number; size: number }) {
  const s = size / 40
  return (
    <g transform={`translate(${x - size / 2} ${y - size / 2}) scale(${s})`}>
      <polygon points="20,3 38,11 20,19 2,11" fill="#3a3a3a" />
      <polygon points="2,11 20,19 20,39 2,31" fill="#111111" />
      <polygon points="20,19 38,11 38,31 20,39" fill="#1c1c1c" />
      <polygon points="2,17 20,25 20,29 2,21" fill="#c9a24d" />
      <polygon points="20,25 38,17 38,21 20,29" fill="#a8842f" />
      <polygon points="26,31.5 33,28.3 33,36 26,39.2" fill="#e2c26b" />
      <polygon points="20,3 38,11 20,19 2,11" fill="none" stroke="#c9a24d" strokeWidth="0.8" />
    </g>
  )
}

/**
 * A qibla compass built like a real one: a metal case, a dial marked in degrees
 * that turns with the phone so north stays north, a needle for north, and the
 * Kaaba on the rim at its true bearing. The fixed red mark at the top is where
 * the phone points; turn until the Kaaba sits under it.
 *
 * The reading is corrected for the difference between magnetic and true north
 * where the person is (magnetic declination), which is what a phone compass on
 * its own leaves out and can be several degrees, more in some countries.
 * Computers have no compass, so there the dial simply shows the bearing.
 */
export default function QiblaCompass({ place }: { place: Place }) {
  const t = useT()
  const bearing = qiblaBearing(place)
  const km = Math.round(distanceToKaabaKm(place))
  const declination = useMemo(() => {
    try {
      return geomagnetism.model(new Date()).point([place.lat, place.lon]).decl
    } catch {
      return 0
    }
  }, [place.lat, place.lon])

  const [sensor, setSensor] = useState<Sensor>('unknown')
  const [heading, setHeading] = useState<number | null>(null)
  const [loose, setLoose] = useState(false)
  const smooth = useRef<number | null>(null)
  const wasFacing = useRef(false)
  const declRef = useRef(declination)
  declRef.current = declination

  const onOrientation = useCallback((e: Event) => {
    const ev = e as OrientationEvent
    let magnetic: number | null = null
    if (typeof ev.webkitCompassHeading === 'number') {
      magnetic = ev.webkitCompassHeading
      if (typeof ev.webkitCompassAccuracy === 'number') {
        setLoose(ev.webkitCompassAccuracy < 0 || ev.webkitCompassAccuracy > POOR_ACCURACY_DEG)
      }
    } else if (typeof ev.alpha === 'number' && (ev.absolute || e.type === 'deviceorientationabsolute')) {
      const angle = typeof screen !== 'undefined' && screen.orientation ? screen.orientation.angle : 0
      magnetic = norm(360 - ev.alpha + angle)
    }
    if (magnetic === null) return
    const trueHeading = norm(magnetic + declRef.current)
    // A little smoothing, taking the short way round north so the dial never spins.
    const previous = smooth.current
    const next = previous === null ? trueHeading : norm(previous + turn(previous, trueHeading) * 0.2)
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
      <div className={`relative mt-1 aspect-square w-full max-w-[20rem] rounded-full transition-shadow duration-300 ${facing ? 'shadow-[0_0_0_4px_rgba(92,196,171,0.55),0_0_38px_6px_rgba(92,196,171,0.45)]' : 'shadow-[0_18px_34px_-14px_rgba(0,0,0,0.55)]'}`}>
        <svg viewBox="0 0 300 300" className="h-full w-full" role="img" aria-label={t('Compass showing the qibla, {degrees} degrees from north', { degrees: Math.round(bearing) })}>
          <defs>
            <linearGradient id="qc-case" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#f4f1e8" />
              <stop offset="0.28" stopColor="#b9b4a6" />
              <stop offset="0.55" stopColor="#6f6b60" />
              <stop offset="0.8" stopColor="#cfcabb" />
              <stop offset="1" stopColor="#57534a" />
            </linearGradient>
            <linearGradient id="qc-gold" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#f3dc9b" />
              <stop offset="0.5" stopColor="#b8893a" />
              <stop offset="1" stopColor="#e7c775" />
            </linearGradient>
            <radialGradient id="qc-face" cx="0.5" cy="0.42" r="0.7">
              <stop offset="0" stopColor="#1f4a3f" />
              <stop offset="0.7" stopColor="#0f2b25" />
              <stop offset="1" stopColor="#081915" />
            </radialGradient>
            <radialGradient id="qc-glass" cx="0.35" cy="0.22" r="0.75">
              <stop offset="0" stopColor="#ffffff" stopOpacity="0.24" />
              <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.04" />
              <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
            </radialGradient>
            <filter id="qc-drop" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="1.5" stdDeviation="1.6" floodColor="#000" floodOpacity="0.55" />
            </filter>
          </defs>

          {/* The case */}
          <circle cx="150" cy="150" r="148" fill="url(#qc-case)" />
          <circle cx="150" cy="150" r="140" fill="none" stroke="#2c2a25" strokeOpacity="0.55" strokeWidth="2" />
          <circle cx="150" cy="150" r="137" fill="url(#qc-gold)" />
          <circle cx="150" cy="150" r="132" fill="url(#qc-face)" />

          {/* The dial: turns so north stays north */}
          <g style={{ transform: `rotate(${dialTurn}deg)`, transformOrigin: '150px 150px', transition: 'transform 120ms linear' }}>
            <circle cx="150" cy="150" r="129" fill="none" stroke="#c9a24d" strokeOpacity="0.5" strokeWidth="0.8" />

            {/* Degrees */}
            {Array.from({ length: 72 }, (_, i) => {
              const deg = i * 5
              const major = deg % 30 === 0
              const ten = deg % 10 === 0
              return (
                <line
                  key={deg}
                  x1="150"
                  y1="20"
                  x2="150"
                  y2={major ? 33 : ten ? 29 : 25.5}
                  stroke={deg === 0 ? '#ef4444' : '#e8dcc0'}
                  strokeOpacity={major ? 1 : ten ? 0.85 : 0.55}
                  strokeWidth={major ? 1.8 : 1}
                  transform={`rotate(${deg} 150 150)`}
                />
              )
            })}
            {Array.from({ length: 12 }, (_, i) => {
              const deg = i * 30
              if (deg % 90 === 0) return null
              return (
                <text
                  key={deg}
                  x="150"
                  y="50"
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="600"
                  fill="#e8dcc0"
                  fillOpacity="0.85"
                  transform={`rotate(${deg} 150 150)`}
                >
                  {deg}
                </text>
              )
            })}

            {/* Cardinal points, each turned upright toward the rim */}
            {[
              ['N', 0, '#ef4444'],
              ['E', 90, '#f3e6c4'],
              ['S', 180, '#f3e6c4'],
              ['W', 270, '#f3e6c4'],
            ].map(([label, deg, fill]) => (
              <text
                key={label as string}
                x="150"
                y="60"
                textAnchor="middle"
                fontSize="21"
                fontWeight="700"
                fontFamily="Georgia, 'Times New Roman', serif"
                fill={fill as string}
                transform={`rotate(${deg} 150 150)`}
              >
                {label as string}
              </text>
            ))}

            {/* An eight-point rose behind the needles */}
            {Array.from({ length: 8 }, (_, i) => (
              <path
                key={i}
                d="M150 150 L143 122 L150 76 L157 122 Z"
                fill={i % 2 === 0 ? '#c9a24d' : '#9a7b34'}
                fillOpacity={i % 2 === 0 ? 0.32 : 0.2}
                stroke="#c9a24d"
                strokeOpacity="0.5"
                strokeWidth="0.5"
                transform={`rotate(${i * 45} 150 150)`}
              />
            ))}
            <circle cx="150" cy="150" r="66" fill="none" stroke="#c9a24d" strokeOpacity="0.28" strokeWidth="0.8" />

            {/* North: a red and white needle */}
            <g filter="url(#qc-drop)">
              <polygon points="150,84 158,150 142,150" fill="#dc2626" />
              <polygon points="150,216 158,150 142,150" fill="#f1efe8" />
            </g>

            {/* The qibla: a gold arrow to the Kaaba on the rim */}
            <g transform={`rotate(${bearing} 150 150)`}>
              <g filter="url(#qc-drop)">
                <polygon points="150,58 160,96 150,90 140,96" fill="url(#qc-gold)" stroke="#fff3c8" strokeWidth="0.6" />
                <rect x="147.6" y="90" width="4.8" height="60" rx="2.4" fill="url(#qc-gold)" />
              </g>
              <circle cx="150" cy="38" r="17" fill="#0a1f1a" stroke="url(#qc-gold)" strokeWidth="2.2" />
              <Kaaba x={150} y={38} size={23} />
            </g>
          </g>

          {/* Fixed: the mark for where the phone points */}
          <polygon points="150,10 158,28 142,28" fill="#ef4444" stroke="#ffffff" strokeWidth="1.4" strokeLinejoin="round" />

          {/* Centre pin and the glass over it all */}
          <circle cx="150" cy="150" r="9" fill="url(#qc-gold)" stroke="#5c4514" strokeWidth="1" />
          <circle cx="150" cy="150" r="3" fill="#2a2110" />
          <circle cx="150" cy="150" r="132" fill="url(#qc-glass)" />
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
            ? t('Turn until the Kaaba is under the red mark')
            : t('The Kaaba is {degrees}° from north', { degrees: Math.round(bearing) })}
      </p>
      <p className="mt-0.5 text-[0.78125rem] text-[var(--home-muted)]">{t('{km} km to the Kaaba', { km: km.toLocaleString() })}</p>

      {loose && sensor === 'running' ? (
        <p className="mt-3 max-w-[30ch] text-center text-xs font-medium text-amber-600 dark:text-amber-400">
          {t('The compass needs calibrating. Move your phone in a figure of eight.')}
        </p>
      ) : null}

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
