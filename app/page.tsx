'use client'

import Link from 'next/link'
import { Menu } from 'lucide-react'
import DateCard from '@/components/home/DateCard'
import HomeScreen from '@/components/home/HomeScreen'
import PromoBanner from '@/components/home/PromoBanner'
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
  return (
    <HomeScreen>
      <header className="mb-5 flex items-center justify-between border-b border-white/[0.06] pb-4 lg:mb-8 lg:pb-6">
        <h1 className="text-[1.35rem] font-bold tracking-tight text-white lg:text-2xl">Al Quran</h1>
        <div className="flex items-center gap-2 lg:gap-3">
          <span className="rounded-md bg-amber-400 px-2.5 py-1 text-[11px] font-bold leading-none text-black lg:px-3 lg:py-1.5 lg:text-xs">
            Pro
          </span>
          <Link
            href="/settings"
            className="rounded-lg p-1.5 text-stone-300 transition-colors hover:bg-white/10 hover:text-white lg:p-2"
            aria-label="Settings"
          >
            <Menu className="h-6 w-6 lg:h-7 lg:w-7" strokeWidth={2} />
          </Link>
        </div>
      </header>

      <div className="mb-5 flex flex-col gap-4 lg:mb-8 lg:grid lg:grid-cols-2 lg:gap-6 xl:gap-8">
        <DateCard className="mb-0 lg:mb-0" />
        <PromoBanner className="mb-0 lg:mb-0" />
      </div>

      <section aria-label="Main actions">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 lg:gap-5 xl:gap-6">
          {tiles.map((tile) => {
            const { Icon } = tile
            const inner = (
              <div
                className={cn(
                  'flex aspect-square flex-col items-center justify-center gap-2.5 rounded-2xl border border-white/[0.06] bg-[#1c1c1e] px-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-all duration-200',
                  'lg:aspect-auto lg:min-h-[180px] lg:gap-3 xl:min-h-[200px]',
                  tile.enabled &&
                    'hover:border-white/10 hover:bg-[#252528] active:scale-[0.97] lg:hover:scale-[1.01] lg:active:scale-[0.99]',
                  !tile.enabled && 'opacity-55'
                )}
              >
                <Icon className="h-12 w-12 text-amber-400 lg:h-14 lg:w-14 xl:h-16 xl:w-16" />
                <span className="text-center text-sm font-medium text-stone-100 lg:text-base">
                  {tile.label}
                </span>
                {'sub' in tile && tile.sub && (
                  <span className="-mt-2 text-[10px] text-stone-500 lg:text-xs">{tile.sub}</span>
                )}
                {!tile.enabled && tile.id === 'memorize' && (
                  <span className="-mt-1 text-[10px] text-stone-600 lg:text-xs">Soon</span>
                )}
              </div>
            )

            if (tile.enabled && tile.href) {
              return (
                <Link
                  key={tile.id}
                  href={tile.href}
                  className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
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
