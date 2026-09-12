'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import ContinueReadingCard from '@/components/home/ContinueReadingCard'
import DailyVerseCard from '@/components/home/DailyVerseCard'
import HomeHero from '@/components/home/HomeHero'
import HomeScreen from '@/components/home/HomeScreen'
import { IconListen, IconQari, IconRead, IconTest } from '@/components/home/TileIcons'
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

const tileSurface =
  'ed-card group relative flex h-full flex-col items-center gap-3 rounded-[1.5rem] p-5 text-center transition-[border-color,transform] duration-200 hover:border-[var(--home-sage)] active:scale-[0.97]'

const tileFocus = 'ed-focus block rounded-[1.5rem]'

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

      <div className="reveal" style={{ animationDelay: '80ms' }}>
        <DailyVerseCard />
      </div>
      <div className="reveal" style={{ animationDelay: '160ms' }}>
        <ContinueReadingCard />
      </div>

      <section aria-label="Explore" className="reveal" style={{ animationDelay: '240ms' }}>
        <div className="mb-3 flex items-center gap-3">
          <h2 className="ed-label">Explore</h2>
          <span className="ed-rule flex-1" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {exploreTiles.map((tile) => {
            const { Icon } = tile
            const inner = (
              <div className={tileSurface}>
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--home-sage-soft)] text-[var(--home-sage-deep)]">
                  <Icon className="h-[30px] w-[30px]" />
                </span>
                <div>
                  <span className="home-serif block text-[1.25rem] font-semibold leading-tight text-[var(--home-heading)]">
                    {tile.label}
                  </span>
                  <span className="mt-1 block text-[0.8rem] leading-snug text-[var(--home-muted)]">
                    {tile.hint}
                  </span>
                </div>
              </div>
            )

            return (
              <Link key={tile.id} href={tile.href} className={tileFocus}>
                {inner}
              </Link>
            )
          })}
        </div>
      </section>
    </HomeScreen>
  )
}
