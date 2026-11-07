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

/** The Kaaba, drawn as the cube it is: black cloth and its gold band. */
function Kaaba({ x, y, size }: { x: number; y: number; size: number }) {
  const s = size / 24
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <polygon points="-12,-5 0,-9.5 12,-5 0,-0.5" fill="#4a5568" />
      <polygon points="-12,-5 0,-0.5 0,11 -12,6.5" fill="#1a1d22" />
      <polygon points="0,-0.5 12,-5 12,6.5 0,11" fill="#262a31" />
      <polygon points="-12,-2 0,2.5 0,5.2 -12,0.7" fill="#c99a2e" />
      <polygon points="0,2.5 12,-2 12,0.7 0,5.2" fill="#e2b445" />
    </g>
  )
}

/**
 * A qibla compass in the look of Home's: a black dial with pale-blue marks and
 * degrees that turns with the phone so north stays north, the Kaaba on the rim
 * at its true bearing and the needle pointing at it, red end first. The fixed
 * white mark at the top is where the phone points; turn until the Kaaba sits
 * under it.
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
      <div className={`relative mt-1 aspect-square w-full max-w-[20rem] rounded-full transition-shadow duration-300 ${facing ? 'shadow-[0_0_0_4px_rgba(47,124,246,0.6),0_0_40px_8px_rgba(47,124,246,0.45)]' : 'shadow-[0_18px_34px_-14px_rgba(0,0,0,0.7)]'}`}>
        <svg viewBox="0 0 300 300" className="h-full w-full" role="img" aria-label={t('Compass showing the qibla, {degrees} degrees from north', { degrees: Math.round(bearing) })}>
          <defs>
            <filter id="qc-drop" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="1.5" stdDeviation="1.6" floodColor="#000" floodOpacity="0.6" />
            </filter>
          </defs>

          {/* The face and its thin rim */}
          <circle cx="150" cy="150" r="148" fill="#0b0c0e" />
          <circle cx="150" cy="150" r="146.5" fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="2" />

          {/* The dial: turns so north stays north */}
          <g style={{ transform: `rotate(${dialTurn}deg)`, transformOrigin: '150px 150px', transition: 'transform 120ms linear' }}>
            {/* Degrees: every 5°, longer every 10° and 30° */}
            <g stroke="#cfe3ff" strokeLinecap="round">
              {Array.from({ length: 72 }, (_, i) => {
                const deg = i * 5
                const major = deg % 30 === 0
                const ten = deg % 10 === 0
                return (
                  <line
                    key={deg}
                    x1="150"
                    y1="14"
                    x2="150"
                    y2={major ? 32 : ten ? 27 : 23}
                    strokeOpacity={major ? 1 : ten ? 0.8 : 0.45}
                    strokeWidth={major ? 3.2 : ten ? 2.2 : 1.6}
                    transform={`rotate(${deg} 150 150)`}
                  />
                )
              })}
            </g>
            {Array.from({ length: 12 }, (_, i) => {
              const deg = i * 30
              // No number where a cardinal point stands, or under the Kaaba.
              if (deg % 90 === 0 || Math.abs(turn(deg, bearing)) < 14) return null
              return (
                <text
                  key={deg}
                  x="150"
                  y="50"
                  textAnchor="middle"
                  fontSize="11.5"
                  fontWeight="700"
                  fontFamily="Arial, Helvetica, sans-serif"
                  fill="#cfe3ff"
                  fillOpacity="0.75"
                  transform={`rotate(${deg} 150 150)`}
                >
                  {deg}
                </text>
              )
            })}

            {/* Cardinal points, each turned upright toward the rim */}
            {(['N', 'E', 'S', 'W'] as const).map((label, i) => (
              <text
                key={label}
                x="150"
                y="66"
                textAnchor="middle"
                fontSize="26"
                fontWeight="900"
                fontFamily="'Arial Black', Arial, sans-serif"
                fill="#dceaff"
                transform={`rotate(${i * 90} 150 150)`}
              >
                {label}
              </text>
            ))}

            {/* The qibla: the Kaaba on the rim at its bearing, the needle pointing at it */}
            <g transform={`rotate(${bearing} 150 150)`}>
              <circle cx="150" cy="33" r="19" fill="#0b0c0e" stroke="#dceaff" strokeOpacity="0.55" strokeWidth="1.6" />
              <Kaaba x={150} y={33} size={26} />
              <g filter="url(#qc-drop)">
                <polygon points="150,72 160,152 140,152" fill="#e5322d" />
                <polygon points="150,236 160,152 140,152" fill="#dceaff" />
              </g>
            </g>
          </g>

          {/* Fixed: the mark for where the phone points */}
          <polygon points="150,4 158,18 142,18" fill="#ffffff" stroke="#0b0c0e" strokeWidth="1.2" strokeLinejoin="round" />

          {/* Centre pin */}
          <circle cx="150" cy="152" r="7" fill="#0b0c0e" stroke="#dceaff" strokeWidth="2" />
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
