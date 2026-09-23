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
 * A small circle of people around an open book — a halaqa, a study circle
 * reading together — drawn in the same gold-and-teal picture style as the
 * compass, instead of a plain book icon.
 */
function HalaqaGlyph() {
  return (
    <svg viewBox="0 0 64 64" className="h-10 w-10 shrink-0" role="img" aria-hidden>
      <defs>
        <linearGradient id="pqt-halaqa-dot" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5cc4ab" />
          <stop offset="1" stopColor="#0d6b63" />
        </linearGradient>
        <linearGradient id="pqt-halaqa-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f3dc9b" />
          <stop offset="1" stopColor="#b8893a" />
        </linearGradient>
      </defs>
      {/* People, seated in a ring. */}
      <circle cx="32" cy="7.5" r="5.6" fill="url(#pqt-halaqa-dot)" />
      <circle cx="53.3" cy="19.8" r="5.6" fill="url(#pqt-halaqa-dot)" />
      <circle cx="53.3" cy="44.2" r="5.6" fill="url(#pqt-halaqa-dot)" />
      <circle cx="32" cy="56.5" r="5.6" fill="url(#pqt-halaqa-dot)" />
      <circle cx="10.7" cy="44.2" r="5.6" fill="url(#pqt-halaqa-dot)" />
      <circle cx="10.7" cy="19.8" r="5.6" fill="url(#pqt-halaqa-dot)" />
      {/* An open book at the centre. */}
      <path
        d="M30 22.5c-3.2-1.9-7-2.7-11.2-2.4a1.8 1.8 0 0 0-1.6 1.8v17.4c0 1 .8 1.8 1.9 1.8 4-.1 7.5.8 11 2.6V22.5z"
        fill="#f1efe8"
      />
      <path
        d="M34 22.5c3.2-1.9 7-2.7 11.2-2.4a1.8 1.8 0 0 1 1.6 1.8v17.4c0 1-.8 1.8-1.9 1.8-4-.1-7.5.8-11 2.6V22.5z"
        fill="#f1efe8"
      />
      <rect x="31.2" y="21.5" width="1.6" height="22.8" rx="0.8" fill="url(#pqt-halaqa-gold)" />
    </svg>
  )
}

function Tile({
  href,
  image,
  title,
  subtitle,
}: {
  href: string
  image: React.ReactNode
  title: string
  subtitle: string
}) {
  return (
    <Link
      href={href}
      className="home-press ed-focus flex flex-col items-center gap-1.5 rounded-2xl px-2 py-3.5 text-center"
    >
      {image}
      <span className="min-w-0 w-full">
        <span className="block truncate text-[0.8125rem] font-semibold text-[var(--home-heading)]">
          {title}
        </span>
        <span className="block truncate text-[0.6875rem] tabular-nums text-[var(--home-muted)]">
          {subtitle}
        </span>
      </span>
    </Link>
  )
}

/**
 * Three small shortcuts below the next-prayer card and above the weekly
 * verse — a picture each instead of a row of text, matching how the rest
 * of Home leads with an image before a label.
 */
export default function PrayerQiblaTiles() {
  const t = useT()
  const { place, ready } = usePrayerState()
  const bearing = useMemo(() => Math.round(qiblaBearing(place)), [place])

  if (!ready) {
    return (
      <div className="grid grid-cols-3 gap-3">
        <div className="h-[6.5rem] animate-pulse rounded-2xl bg-[var(--home-track)]" />
        <div className="h-[6.5rem] animate-pulse rounded-2xl bg-[var(--home-track)]" />
        <div className="h-[6.5rem] animate-pulse rounded-2xl bg-[var(--home-track)]" />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-3 gap-3">
      <Tile
        href="/prayer/qibla"
        image={<QiblaGlyph />}
        title={t('Qibla')}
        subtitle={t('{degrees}°', { degrees: bearing })}
      />
      <Tile
        href="/prayer"
        image={<img src="/icons/noto/mosque.svg" alt="" className="h-10 w-10 shrink-0" />}
        title={t('Prayer')}
        subtitle={t('Times')}
      />
      <Tile
        href="/halaqa"
        image={<HalaqaGlyph />}
        title={t('Halaqa')}
        subtitle={t('Group reading')}
      />
    </div>
  )
}
