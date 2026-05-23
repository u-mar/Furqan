'use client'

import Link from 'next/link'
import { Settings } from 'lucide-react'
import DateCard from '@/components/home/DateCard'
import HomeScreen from '@/components/home/HomeScreen'
import PromoBanner from '@/components/home/PromoBanner'
import { useAppSettings } from '@/hooks/useAppSettings'
import {
  IconMemorize,
  IconMore,
  IconRead,
  IconTest,
} from '@/components/home/TileIcons'
import { cn } from '@/lib/cn'

const tiles = [
  {
    id: 'read',
    label: 'Read',
    href: '/read',
    Icon: IconRead,
    enabled: true,
  },
  {
    id: 'test',
    label: 'Test',
    sub: '(Hifdh)',
    href: '/test/select',
    Icon: IconTest,
    enabled: true,
  },
  {
    id: 'memorize',
    label: 'Memorize',
    href: null,
    Icon: IconMemorize,
    enabled: false,
  },
  {
    id: 'more',
    label: '—',
    href: null,
    Icon: IconMore,
    enabled: false,
  },
] as const

export default function Home() {
  useAppSettings()

  return (
    <HomeScreen>
      <header className="mb-5 flex items-center justify-between border-b border-[var(--home-card-border)] pb-4 lg:mb-8 lg:pb-6">
        <h1 className="text-[1.35rem] font-bold tracking-tight text-[var(--app-text)] lg:text-2xl">
          Al Quran
        </h1>
        <Link
          href="/settings"
          className="relative z-20 flex min-h-[48px] min-w-[48px] items-center justify-center rounded-xl text-[var(--app-muted)] transition-colors hover:bg-[var(--app-surface)] hover:text-[var(--app-text)] active:scale-95"
          aria-label="Open settings"
        >
          <Settings className="h-7 w-7" strokeWidth={1.75} />
        </Link>
      </header>

      <div className="mb-5 flex flex-col gap-4 lg:mb-8 lg:grid lg:grid-cols-2 lg:gap-6 xl:gap-8">
        <DateCard className="mb-0" />
        <PromoBanner className="mb-0" />
      </div>

      <section aria-label="Main actions">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 lg:gap-5 xl:gap-6">
          {tiles.map((tile) => {
            const { Icon } = tile
            const inner = (
              <div
                className={cn(
                  'flex aspect-square flex-col items-center justify-center gap-2.5 rounded-2xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] px-2 shadow-[var(--home-card-shadow)] transition-all duration-200',
                  'lg:aspect-auto lg:min-h-[180px] lg:gap-3 xl:min-h-[200px]',
                  tile.enabled &&
                    'hover:border-teal-500/30 active:scale-[0.97] lg:hover:scale-[1.01] lg:active:scale-[0.99]',
                  !tile.enabled && 'opacity-55'
                )}
              >
                <Icon className="h-12 w-12 text-amber-500 dark:text-amber-400 lg:h-14 lg:w-14 xl:h-16 xl:w-16" />
                <span className="text-center text-sm font-medium text-[var(--app-text)] lg:text-base">
                  {tile.label}
                </span>
                {'sub' in tile && tile.sub && (
                  <span className="-mt-2 text-[10px] text-[var(--app-muted)] lg:text-xs">{tile.sub}</span>
                )}
                {!tile.enabled && tile.id === 'memorize' && (
                  <span className="-mt-1 text-[10px] text-[var(--app-muted)] lg:text-xs">Soon</span>
                )}
              </div>
            )

            if (tile.enabled && tile.href) {
              return (
                <Link
                  key={tile.id}
                  href={tile.href}
                  className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/60"
                >
                  {inner}
                </Link>
              )
            }

            return (
              <div key={tile.id} className="cursor-default" aria-disabled>
                {inner}
              </div>
            )
          })}
        </div>
      </section>
    </HomeScreen>
  )
}
