'use client'

import Link from 'next/link'
import { ArrowRight, ChevronLeft, Dices, MicVocal, Sparkles, Users } from 'lucide-react'
import HomeScreen from '@/components/home/HomeScreen'
import { cn } from '@/lib/cn'

const modes = [
  {
    id: 'random',
    label: 'Randomize',
    description: 'Random ayah within surah, juz, or surah range',
    href: '/test/select/random',
    Icon: Dices,
    enabled: true,
  },
  {
    id: 'subac',
    label: 'Subac',
    description: 'Group reading — each person their own ayah',
    href: null,
    Icon: Users,
    enabled: false,
  },
  {
    id: 'tajweed',
    label: 'Tajweed',
    description: 'Tajweed rules & pronunciation',
    href: null,
    Icon: MicVocal,
    enabled: false,
  },
] as const

export default function TestSelectPage() {
  return (
    <HomeScreen>
      <header className="mb-5 flex items-center gap-3 border-b border-[var(--home-card-border)] pb-4 lg:mb-7">
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

      <section className="mb-5 overflow-hidden rounded-3xl border border-teal-500/20 bg-gradient-to-br from-teal-500/15 via-[var(--home-card-bg)] to-[var(--home-card-bg)] p-5 shadow-[var(--home-card-shadow)]">
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-500/15 text-teal-600 dark:text-teal-300">
          <Sparkles className="h-5 w-5" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-[var(--app-text)]">Practice smarter</h2>
        <p className="mt-1 text-sm leading-relaxed text-[var(--app-muted)]">
          Pick a scope, reveal ayahs one by one, and keep your hifdh sharp with a clean mushaf view.
        </p>
      </section>

      <section
        aria-label="Test modes"
        className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4"
      >
        {modes.map((mode) => {
          const { Icon } = mode
          const inner = (
            <div
              className={cn(
                'relative flex min-h-[160px] flex-col items-start justify-between gap-4 overflow-hidden rounded-3xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] px-5 py-5 text-left shadow-[var(--home-card-shadow)] transition-all duration-200',
                mode.enabled &&
                  'hover:-translate-y-0.5 hover:border-teal-500/35 hover:shadow-md active:scale-[0.98]',
                !mode.enabled && 'opacity-65'
              )}
            >
              <span className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-teal-500/10" />
              {!mode.enabled && (
                <span className="absolute right-3 top-3 rounded-full bg-[var(--app-surface)] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--app-muted)]">
                  Soon
                </span>
              )}
              <div className="relative z-10 flex w-full items-start justify-between gap-3">
                <div
                  className={cn(
                    'flex h-14 w-14 items-center justify-center rounded-2xl',
                    mode.enabled ? 'bg-teal-500/15' : 'bg-[var(--app-surface)]'
                  )}
                >
                  <Icon
                    className={cn(
                      'h-7 w-7',
                      mode.enabled ? 'text-teal-600 dark:text-teal-400' : 'text-[var(--app-muted)]'
                    )}
                    strokeWidth={1.75}
                  />
                </div>
                {mode.enabled && <ArrowRight className="mt-3 h-5 w-5 text-teal-600 dark:text-teal-400" />}
              </div>
              <div className="relative z-10">
                <span className="block text-lg font-bold text-[var(--app-text)]">{mode.label}</span>
                <span className="mt-1 block text-sm leading-relaxed text-[var(--app-muted)]">
                  {mode.description}
                </span>
              </div>
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
