'use client'

import Link from 'next/link'
import { Menu, Users, X } from 'lucide-react'
import { useState } from 'react'
import ContinueReadingCard from '@/components/home/ContinueReadingCard'
import DailyVerseCard from '@/components/home/DailyVerseCard'
import HomeScreen from '@/components/home/HomeScreen'
import {
  IconListen,
  IconRead,
  IconTest,
} from '@/components/home/TileIcons'
import { useAppSettings } from '@/hooks/useAppSettings'
import { cn } from '@/lib/cn'

const exploreTiles = [
  { id: 'read', label: 'Read', href: '/read', Icon: IconRead },
  { id: 'test', label: 'Test', href: '/test/select', Icon: IconTest },
  { id: 'community', label: 'Community', href: null, Icon: Users },
  { id: 'listen', label: 'Listen', href: '/listen', Icon: IconListen },
] as const

export default function Home() {
  useAppSettings()
  const [communityOpen, setCommunityOpen] = useState(false)

  return (
    <HomeScreen className="max-w-lg mx-auto">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-[var(--home-muted)]">Assalamu&apos;alaikum,</p>
          <h1 className="home-serif mt-0.5 text-[2rem] font-semibold leading-tight text-[var(--home-heading)]">
            Reader
          </h1>
        </div>
        <Link
          href="/settings"
          className="mt-1 flex min-h-[48px] min-w-[48px] items-center justify-center rounded-xl text-[var(--home-heading)] transition-colors hover:bg-black/5 active:scale-95 dark:hover:bg-white/10"
          aria-label="Open settings"
        >
          <Menu className="h-7 w-7" strokeWidth={1.75} />
        </Link>
      </header>

      <DailyVerseCard />
      <ContinueReadingCard />

      <section aria-label="Explore">
        <h2 className="home-serif mb-4 text-xl font-semibold text-[var(--home-heading)]">Explore</h2>
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {exploreTiles.map((tile) => {
            const { Icon } = tile
            const inner = (
              <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] px-4 py-7 shadow-[var(--home-card-shadow)] transition-transform active:scale-[0.98]">
                <span className="flex h-12 w-12 items-center justify-center text-[var(--home-sage-deep)]">
                  <Icon className="h-10 w-10" strokeWidth={tile.id === 'community' ? 1.5 : undefined} />
                </span>
                <span className="text-sm font-medium text-[var(--home-heading)]">{tile.label}</span>
              </div>
            )

            if (tile.id === 'community') {
              return (
                <button
                  key={tile.id}
                  type="button"
                  onClick={() => setCommunityOpen(true)}
                  className="text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--home-sage)]/50 rounded-2xl"
                >
                  {inner}
                </button>
              )
            }

            return (
              <Link
                key={tile.id}
                href={tile.href!}
                className="rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--home-sage)]/50"
              >
                {inner}
              </Link>
            )
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
            className={cn(
              'w-full max-w-md rounded-3xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] p-5 text-[var(--app-text)] shadow-2xl'
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--home-sage)]">
                  Coming soon
                </p>
                <h2 id="community-title" className="home-serif mt-1 text-xl font-semibold">
                  Community
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setCommunityOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-[var(--app-muted)] hover:bg-[var(--app-surface)]"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm leading-relaxed text-[var(--app-muted)]">
              A public place where learners can record their own qiraat, share recitations, and listen
              to others practicing.
            </p>
          </div>
        </div>
      )}
    </HomeScreen>
  )
}
