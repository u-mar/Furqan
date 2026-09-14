'use client'

import Link from 'next/link'
import { IconListen, IconQari, IconRead, IconTest } from '@/components/home/TileIcons'
import { useEffect, useState } from 'react'
import ContinueReadingCard from '@/components/home/ContinueReadingCard'
import DailyVerseCard from '@/components/home/DailyVerseCard'
import HomeHero from '@/components/home/HomeHero'
import HomeScreen from '@/components/home/HomeScreen'
import { useAppSettings } from '@/hooks/useAppSettings'
import { getSignedInUser } from '@/lib/auth'

const exploreTiles = [
  {
    id: 'read',
    index: '01',
    label: 'Read',
    hint: 'Mushaf & translation',
    href: '/read',
    Icon: IconRead,
  },
  {
    id: 'test',
    index: '02',
    label: 'Test',
    hint: 'Check your hifdh',
    href: '/test/select',
    Icon: IconTest,
  },
  {
    id: 'qari',
    index: '03',
    label: 'Qari',
    hint: 'Share your recitation',
    href: '/qari',
    Icon: IconQari,
  },
  {
    id: 'listen',
    index: '04',
    label: 'Listen',
    hint: 'Beautiful recitation',
    href: '/listen',
    Icon: IconListen,
  },
] as const

export default function Home() {
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
      <HomeHero displayName={displayName} />

      <div className="reveal mt-[22px]" style={{ animationDelay: '80ms' }}>
        <DailyVerseCard />
      </div>
      <div className="reveal mt-[22px]" style={{ animationDelay: '160ms' }}>
        <ContinueReadingCard />
      </div>

      <section aria-label="Explore" className="reveal mt-[22px]" style={{ animationDelay: '240ms' }}>
        <h2 className="home-label mb-[9px]">Explore</h2>
        <div className="grid grid-cols-2 gap-2.5">
          {exploreTiles.map((tile) => {
            const { Icon } = tile
            return (
              <Link
                key={tile.id}
                href={tile.href}
                className="home-card home-press ed-focus block rounded-2xl p-3.5 text-left"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-[11px] bg-[var(--home-sage-soft)] text-[var(--home-sage-deep)]">
                  <Icon className="h-6 w-6" />
                </span>
                <span className="home-serif mt-3 block text-[1.0625rem] font-semibold leading-snug text-[var(--home-heading)]">
                  {tile.label}
                </span>
                <span className="mt-px block text-[0.78125rem] leading-snug text-[var(--home-muted)]">
                  {tile.hint}
                </span>
              </Link>
            )
          })}
        </div>
      </section>
    </HomeScreen>
  )
}
