'use client'

import Link from 'next/link'
import { ListenArt, PrayerArt, QariArt, ReadArt } from '@/components/home/ExploreArt'
import { useEffect, useState } from 'react'
import ContinueReadingCard from '@/components/home/ContinueReadingCard'
import DailyVerseCard from '@/components/home/DailyVerseCard'
import HomeHero from '@/components/home/HomeHero'
import HomeScreen from '@/components/home/HomeScreen'
import { useAppSettings } from '@/hooks/useAppSettings'
import { getSignedInUser } from '@/lib/auth'
import { useT } from '@/lib/i18n'

const exploreTiles = [
  {
    id: 'read',
    label: 'Read',
    hint: 'Mushaf & translation',
    href: '/read',
    Art: ReadArt,
  },
  {
    id: 'prayer',
    label: 'Prayer',
    hint: 'Adhan & Qibla',
    href: '/prayer',
    Art: PrayerArt,
  },
  {
    id: 'qari',
    label: 'Qari',
    hint: 'Share your recitation',
    href: '/qari',
    Art: QariArt,
  },
  {
    id: 'listen',
    label: 'Listen',
    hint: 'Beautiful recitation',
    href: '/listen',
    Art: ListenArt,
  },
] as const

export default function Home() {
  const t = useT()
  useAppSettings()
  const [displayName, setDisplayName] = useState('Guest')

  useEffect(() => {
    const syncName = () => setDisplayName(getSignedInUser()?.name ?? 'Guest')
    syncName()
    window.addEventListener('auth-user-changed', syncName)
    return () => window.removeEventListener('auth-user-changed', syncName)
  }, [])

  return (
    <HomeScreen className="max-w-lg mx-auto">
      <HomeHero displayName={displayName === 'Guest' ? t('Guest') : displayName} />

      <div className="reveal mt-[22px]" style={{ animationDelay: '80ms' }}>
        <DailyVerseCard />
      </div>
      <div className="reveal mt-[22px]" style={{ animationDelay: '160ms' }}>
        <ContinueReadingCard />
      </div>

      <section aria-label={t('Explore')} className="reveal mt-[22px] flex flex-1 flex-col" style={{ animationDelay: '240ms' }}>
        <h2 className="home-label mb-[9px]">{t('Explore')}</h2>
        {/* The four cards share whatever height is left, so they reach the bottom on any phone. */}
        <div className="grid flex-1 grid-cols-2 grid-rows-2 gap-2.5">
          {exploreTiles.map((tile) => {
            const { Art } = tile
            return (
              <Link
                key={tile.id}
                href={tile.href}
                className={`explore-tile explore-tile--${tile.id} home-press ed-focus flex min-h-[7.25rem] flex-col justify-end rounded-2xl p-3.5 text-left`}
              >
                <Art className="explore-tile__art" />
                <span className="block">
                  <span className="home-serif block text-[1.1875rem] font-semibold leading-snug text-[var(--home-heading)]">
                    {t(tile.label)}
                  </span>
                  <span className="mt-px block text-[0.78125rem] leading-snug text-[color-mix(in_srgb,var(--home-heading)_62%,transparent)]">
                    {t(tile.hint)}
                  </span>
                </span>
              </Link>
            )
          })}
        </div>
      </section>
    </HomeScreen>
  )
}
