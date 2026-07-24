'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Mic } from 'lucide-react'
import { useEffect, useState } from 'react'
import ContinueReadingCard from '@/components/home/ContinueReadingCard'
import DailyVerseCard from '@/components/home/DailyVerseCard'
import HomeHero from '@/components/home/HomeHero'
import HomeScreen from '@/components/home/HomeScreen'
import ImitatePinDialog from '@/components/imitate/ImitatePinDialog'
import {
  IconListen,
  IconRead,
  IconTest,
} from '@/components/home/TileIcons'
import { useAppSettings } from '@/hooks/useAppSettings'
import { getSignedInUser } from '@/lib/auth'
import { isImitateUnlocked } from '@/lib/imitate-access'

const exploreTiles = [
  {
    id: 'read',
    label: 'Read',
    hint: 'Mushaf & translation',
    href: '/read',
    Icon: IconRead,
    gradient: 'linear-gradient(150deg, #8163ef 0%, #4b39a2 100%)',
    glow: 'rgba(122, 92, 240, 0.45)',
  },
  {
    id: 'test',
    label: 'Test',
    hint: 'Check your hifdh',
    href: '/test/select',
    Icon: IconTest,
    gradient: 'linear-gradient(150deg, #f0c877 0%, #d29a3c 100%)',
    glow: 'rgba(226, 171, 83, 0.45)',
  },
  {
    id: 'imitate',
    label: 'Imitate',
    hint: 'Match the reciter',
    href: null,
    Icon: Mic,
    gradient: 'linear-gradient(150deg, #f27ba4 0%, #c9527e 100%)',
    glow: 'rgba(224, 114, 150, 0.45)',
  },
  {
    id: 'listen',
    label: 'Listen',
    hint: 'Beautiful recitation',
    href: '/listen',
    Icon: IconListen,
    gradient: 'linear-gradient(150deg, #47c6d4 0%, #2a8fa0 100%)',
    glow: 'rgba(56, 184, 196, 0.45)',
  },
] as const

export default function Home() {
  useAppSettings()
  const router = useRouter()
  const [pinOpen, setPinOpen] = useState(false)
  const [imitateUnlocked, setImitateUnlocked] = useState(false)
  const [displayName, setDisplayName] = useState('Guest')

  useEffect(() => {
    const syncName = () => setDisplayName(getSignedInUser()?.name ?? 'Guest')
    syncName()
    window.addEventListener('auth-user-changed', syncName)
    return () => window.removeEventListener('auth-user-changed', syncName)
  }, [])

  useEffect(() => {
    const sync = () => setImitateUnlocked(isImitateUnlocked())
    sync()
    window.addEventListener('imitate-access-changed', sync)
    return () => window.removeEventListener('imitate-access-changed', sync)
  }, [])

  function handleImitateClick() {
    if (imitateUnlocked) {
      router.push('/imitate')
      return
    }
    setPinOpen(true)
  }

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
        <div className="mb-4 flex items-center gap-3">
          <h2 className="home-serif text-xl font-semibold text-[var(--home-heading)]">Explore</h2>
          <span className="h-px flex-1 bg-gradient-to-r from-[var(--home-card-border)] to-transparent" />
        </div>
        <div className="grid grid-cols-2 gap-3.5">
          {exploreTiles.map((tile) => {
            const { Icon } = tile
            const inner = (
              <div
                className="group relative flex h-full flex-col gap-3 overflow-hidden rounded-[1.4rem] border border-[var(--home-card-border)] bg-[var(--home-card-bg)] p-4 shadow-[var(--home-card-shadow)] transition-all duration-200 active:scale-[0.97]"
              >
                <span
                  className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full opacity-70 blur-2xl transition-opacity group-hover:opacity-100"
                  style={{ background: tile.glow }}
                  aria-hidden
                />
                <span
                  className="relative flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-lg"
                  style={{ background: tile.gradient, boxShadow: `0 10px 22px -8px ${tile.glow}` }}
                >
                  <Icon
                    className="h-8 w-8"
                    strokeWidth={tile.id === 'imitate' ? 1.9 : undefined}
                  />
                </span>
                <span className="relative">
                  <span className="block text-[0.95rem] font-semibold text-[var(--home-heading)]">
                    {tile.label}
                  </span>
                  <span className="mt-0.5 block text-xs text-[var(--home-muted)]">{tile.hint}</span>
                </span>
              </div>
            )

            if (tile.id === 'imitate') {
              return (
                <button
                  key={tile.id}
                  type="button"
                  onClick={handleImitateClick}
                  className="rounded-[1.4rem] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--home-sage)]/50"
                >
                  {inner}
                </button>
              )
            }

            return (
              <Link
                key={tile.id}
                href={tile.href!}
                className="rounded-[1.4rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--home-sage)]/50"
              >
                {inner}
              </Link>
            )
          })}
        </div>
      </section>

      {pinOpen && (
        <ImitatePinDialog
          open
          navigateOnUnlock
          onClose={() => setPinOpen(false)}
          onUnlocked={() => setImitateUnlocked(true)}
        />
      )}
    </HomeScreen>
  )
}
