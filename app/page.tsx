'use client'

import Link from 'next/link'
import { Settings, X } from 'lucide-react'
import { useState } from 'react'
import DateCard from '@/components/home/DateCard'
import HomeScreen from '@/components/home/HomeScreen'
import PromoBanner from '@/components/home/PromoBanner'
import { useAppSettings } from '@/hooks/useAppSettings'
import {
  IconMemorize,
  IconListen,
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
    id: 'community',
    label: 'Community',
    href: null,
    Icon: IconMemorize,
    enabled: true,
  },
  {
    id: 'listen',
    label: 'Listen',
    href: '/listen',
    Icon: IconListen,
    enabled: true,
  },
] as const

export default function Home() {
  useAppSettings()
  const [communityOpen, setCommunityOpen] = useState(false)

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
                  'flex aspect-square flex-col items-center justify-center gap-2.5 rounded-2xl border border-emerald-200 bg-white px-2 shadow-[0_14px_34px_rgba(16,185,129,0.09)] transition-all duration-200',
                  'lg:aspect-auto lg:min-h-[180px] lg:gap-3 xl:min-h-[200px]',
                  tile.enabled &&
                    'hover:border-emerald-400 active:scale-[0.97] lg:hover:scale-[1.01] lg:active:scale-[0.99]',
                  !tile.enabled && 'opacity-55'
                )}
              >
                <Icon className="h-12 w-12 text-emerald-600 lg:h-14 lg:w-14 xl:h-16 xl:w-16" />
                <span className="text-center text-sm font-medium text-emerald-950 lg:text-base">
                  {tile.label}
                </span>
                {'sub' in tile && tile.sub && (
                  <span className="-mt-2 text-[10px] text-emerald-700/70 lg:text-xs">{tile.sub}</span>
                )}
                {tile.id === 'community' && (
                  <span className="-mt-1 text-[10px] text-emerald-600 lg:text-xs">
                    Coming soon
                  </span>
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

            if (tile.id === 'community') {
              return (
                <button
                  key={tile.id}
                  type="button"
                  onClick={() => setCommunityOpen(true)}
                  className="block rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/60"
                >
                  {inner}
                </button>
              )
            }

            return <div key={tile.id}>{inner}</div>
          })}
        </div>
      </section>

      {communityOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 px-4 pb-4 pt-10 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="community-title"
          onClick={() => setCommunityOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] p-5 text-[var(--app-text)] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                  Coming soon
                </p>
                <h2 id="community-title" className="mt-1 text-xl font-bold">
                  Community Qiraat
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setCommunityOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-[var(--app-muted)] hover:bg-[var(--app-surface)]"
                aria-label="Close community message"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm leading-relaxed text-[var(--app-muted)]">
              A public place where learners can record their own qiraat, share recitations, and listen
              to others practicing beautifully like the sheikhs.
            </p>
          </div>
        </div>
      )}
    </HomeScreen>
  )
}
