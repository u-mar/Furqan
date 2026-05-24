'use client'

import Link from 'next/link'
import { ChevronLeft, Dices, MicVocal, Sparkles, Users } from 'lucide-react'
import HomeScreen from '@/components/home/HomeScreen'
import { cn } from '@/lib/cn'

const modes = [
  {
    id: 'random',
    label: 'Randomize',
    description: 'Random ayah within a surah, juz, or range',
    href: '/test/select/random',
    Icon: Dices,
    enabled: true,
  },
  {
    id: 'subac',
    label: 'Subac',
    description: 'Group session — each person their own ayah',
    href: '/test/select/subac',
    Icon: Users,
    enabled: true,
  },
  {
    id: 'tajweed',
    label: 'Tajweed',
    description: 'Tajweed rules & pronunciation',
    href: null,
    Icon: MicVocal,
    enabled: false,
  },
  {
    id: 'custom',
    label: 'Custom',
    description: 'Ayah range & blind mode',
    href: null,
    Icon: Sparkles,
    enabled: false,
  },
] as const

export default function TestSelectPage() {
  return (
    <HomeScreen>
      <header className="mb-6 flex items-center gap-3 border-b border-[var(--home-card-border)] pb-4 lg:mb-8">
        <Link
          href="/"
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-[var(--app-muted)] transition-colors hover:bg-[var(--app-surface)] hover:text-[var(--app-text)]"
          aria-label="Back to home"
        >
          <ChevronLeft className="h-6 w-6" />
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--app-text)] lg:text-2xl">
            Test
          </h1>
          <p className="text-sm text-[var(--app-muted)]">Choose how you want to practice</p>
        </div>
      </header>

      <section aria-label="Test modes" className="grid grid-cols-2 gap-3 sm:gap-4 lg:gap-5">
        {modes.map((mode) => {
          const { Icon } = mode
          const inner = (
            <div
              className={cn(
                'relative flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] px-3 py-4 shadow-[var(--home-card-shadow)] transition-all duration-200',
                'lg:aspect-auto lg:min-h-[160px] lg:gap-3',
                mode.enabled &&
                  'hover:border-teal-500/30 active:scale-[0.97] lg:hover:scale-[1.01]',
                !mode.enabled && 'opacity-60'
              )}
            >
              {!mode.enabled && (
                <span className="absolute right-2.5 top-2.5 rounded-full bg-[var(--app-surface)] px-2 py-0.5 text-[10px] font-medium text-[var(--app-muted)]">
                  Soon
                </span>
              )}
              <Icon
                className={cn(
                  'h-10 w-10 lg:h-12 lg:w-12',
                  mode.enabled ? 'text-teal-600 dark:text-teal-400' : 'text-[var(--app-muted)]'
                )}
                strokeWidth={1.75}
              />
              <span className="text-center text-sm font-semibold text-[var(--app-text)] lg:text-base">
                {mode.label}
              </span>
              <span className="line-clamp-2 text-center text-[10px] leading-snug text-[var(--app-muted)] lg:text-xs">
                {mode.description}
              </span>
            </div>
          )

          if (mode.enabled && mode.href) {
            return (
              <Link
                key={mode.id}
                href={mode.href}
                className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/60"
              >
                {inner}
              </Link>
            )
          }

          return (
            <div key={mode.id} className="cursor-default" aria-disabled>
              {inner}
            </div>
          )
        })}
      </section>
    </HomeScreen>
  )
}
