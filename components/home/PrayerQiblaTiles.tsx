'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { usePrayerState } from '@/hooks/usePrayer'
import { qiblaBearing } from '@/lib/prayer'
import { useT } from '@/lib/i18n'

/**
 * A small still picture of the qibla compass from the Prayer screen — same
 * case, dial and gold Kaaba marker, just fixed instead of live, for a tile
 * this size.
 */
function QiblaGlyph() {
  return (
    <svg viewBox="0 0 64 64" className="h-10 w-10 shrink-0" role="img" aria-hidden>
      <defs>
        <linearGradient id="pqt-case" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f4f1e8" />
          <stop offset="0.5" stopColor="#9a9587" />
          <stop offset="1" stopColor="#57534a" />
        </linearGradient>
        <linearGradient id="pqt-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f3dc9b" />
          <stop offset="1" stopColor="#b8893a" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="31" fill="url(#pqt-case)" />
      <circle cx="32" cy="32" r="28" fill="url(#pqt-gold)" />
      <circle cx="32" cy="32" r="25" fill="#123a30" />
      <circle cx="32" cy="32" r="24" fill="none" stroke="#c9a24d" strokeOpacity="0.45" strokeWidth="0.8" />
      <polygon points="32,10 36.5,32 27.5,32" fill="#dc2626" />
      <polygon points="32,54 36.5,32 27.5,32" fill="#f1efe8" />
      <circle cx="32" cy="14" r="4.6" fill="#0a1f1a" stroke="url(#pqt-gold)" strokeWidth="1.2" />
      <polygon points="32,10.7 35.2,13 32,14.6 28.8,13" fill="#c9a24d" />
      <circle cx="32" cy="32" r="2.8" fill="url(#pqt-gold)" stroke="#5c4514" strokeWidth="0.6" />
    </svg>
  )
}

/**
 * Two small shortcuts into the Prayer screen, below the next-prayer card and
 * above the weekly verse — a picture each instead of a row of text, matching
 * how the rest of Home leads with an image before a label.
 */
export default function PrayerQiblaTiles() {
  const t = useT()
  const { place, ready } = usePrayerState()
  const bearing = useMemo(() => Math.round(qiblaBearing(place)), [place])

  if (!ready) {
    return (
      <div className="grid grid-cols-2 gap-3">
        <div className="h-[4.5rem] animate-pulse rounded-2xl bg-[var(--home-track)]" />
        <div className="h-[4.5rem] animate-pulse rounded-2xl bg-[var(--home-track)]" />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      <Link
        href="/prayer/qibla"
        className="home-card home-press ed-focus flex items-center gap-3 rounded-2xl px-3.5 py-3.5"
      >
        <QiblaGlyph />
        <span className="min-w-0">
          <span className="block truncate text-[0.9375rem] font-semibold text-[var(--home-heading)]">
            {t('Qibla')}
          </span>
          <span className="block truncate text-[0.8125rem] tabular-nums text-[var(--home-muted)]">
            {t('{degrees}°', { degrees: bearing })}
          </span>
        </span>
      </Link>

      <Link
        href="/prayer"
        className="home-card home-press ed-focus flex items-center gap-3 rounded-2xl px-3.5 py-3.5"
      >
        <img src="/icons/noto/mosque.svg" alt="" className="h-10 w-10 shrink-0" />
        <span className="min-w-0">
          <span className="block truncate text-[0.9375rem] font-semibold text-[var(--home-heading)]">
            {t('Prayer')}
          </span>
          <span className="block truncate text-[0.8125rem] text-[var(--home-muted)]">{t('Times')}</span>
        </span>
      </Link>
    </div>
  )
}
