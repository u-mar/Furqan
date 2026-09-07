'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowUpRight, Lock, Mic } from 'lucide-react'
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
    id: 'imitate',
    index: '03',
    label: 'Imitate',
    hint: 'Match the reciter',
    href: null,
    Icon: Mic,
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
  'ed-card group relative flex h-full flex-col gap-3.5 rounded-[1.5rem] p-4 transition-[border-color,transform] duration-200 hover:border-[var(--home-sage)] active:scale-[0.97]'

const tileFocus = 'ed-focus block rounded-[1.5rem] text-left'

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
        <div className="mb-3 flex items-center gap-3">
          <h2 className="ed-label">Explore</h2>
          <span className="ed-rule flex-1" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {exploreTiles.map((tile) => {
            const { Icon } = tile
            const locked = tile.id === 'imitate' && !imitateUnlocked
            const inner = (
              <div className={tileSurface}>
                <div className="flex items-center justify-between">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--home-sage-soft)] text-[var(--home-sage-deep)]">
                    <Icon
                      className="h-[26px] w-[26px]"
                      strokeWidth={tile.id === 'imitate' ? 1.8 : undefined}
                    />
                  </span>
                  {locked ? (
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--home-track)] text-[var(--home-muted)]">
                      <Lock className="h-3 w-3" strokeWidth={2.2} aria-label="Locked" />
                    </span>
                  ) : (
                    <ArrowUpRight
                      className="h-[18px] w-[18px] text-[var(--home-muted)] transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                      aria-hidden
                    />
                  )}
                </div>
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

            if (tile.id === 'imitate') {
              return (
                <button
                  key={tile.id}
                  type="button"
                  onClick={handleImitateClick}
                  className={tileFocus}
                >
                  {inner}
                </button>
              )
            }

            return (
              <Link key={tile.id} href={tile.href!} className={tileFocus}>
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
