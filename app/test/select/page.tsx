'use client'

import Link from 'next/link'
import { ChevronLeft, ChevronRight, Dices, Users } from 'lucide-react'
import HomeScreen from '@/components/home/HomeScreen'

const modes = [
  {
    id: 'random',
    label: 'Random ayah',
    description: 'Practise on your own — a random ayah from a juz or surah range.',
    meta: 'Solo',
    href: '/test/select/random',
    Icon: Dices,
  },
  {
    id: 'subac',
    label: 'Group round',
    description: 'Everyone takes a turn — each person is given their own ayah to continue.',
    meta: '2+ people',
    href: '/test/select/subac',
    Icon: Users,
  },
] as const

export default function TestSelectPage() {
  return (
    <HomeScreen className="mx-auto max-w-lg">
      <header className="mb-6 flex items-center gap-3">
        <Link
          href="/"
          className="ed-focus flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--home-rule-strong)] text-[var(--home-heading)] transition-colors hover:bg-[var(--home-ink)] hover:text-[var(--home-ink-fg)] active:scale-95"
          aria-label="Back to home"
        >
          <ChevronLeft className="h-5 w-5" strokeWidth={1.75} />
        </Link>
        <div className="min-w-0">
          <p className="ed-label">Test</p>
          <h1 className="home-serif mt-1 text-[2rem] font-medium leading-none tracking-[-0.025em] text-[var(--home-heading)]">
            How to practise
          </h1>
        </div>
      </header>

      <section aria-label="Test modes" className="space-y-3">
        {modes.map(({ id, label, description, meta, href, Icon }) => (
          <Link key={id} href={href} className="ed-focus block rounded-[1.5rem]">
            <div className="ed-card group flex items-start gap-4 rounded-[1.5rem] p-4 transition-[border-color,transform] duration-200 hover:border-[var(--home-sage)] active:scale-[0.98]">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--home-sage-soft)] text-[var(--home-sage-deep)]">
                <Icon className="h-[26px] w-[26px]" strokeWidth={1.9} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="home-serif whitespace-nowrap text-[1.25rem] font-semibold leading-tight text-[var(--home-heading)]">
                    {label}
                  </span>
                  <span className="whitespace-nowrap rounded-full bg-[var(--home-track)] px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--home-muted)]">
                    {meta}
                  </span>
                </span>
                <span className="mt-1 block text-[0.82rem] leading-snug text-[var(--home-muted)]">
                  {description}
                </span>
              </span>
              <ChevronRight
                className="mt-1 h-5 w-5 shrink-0 text-[var(--home-muted)] transition-transform duration-200 group-hover:translate-x-0.5"
                aria-hidden
              />
            </div>
          </Link>
        ))}
      </section>

      <p className="mt-5 text-xs leading-relaxed text-[var(--home-muted)]">
        The page is hidden — read from memory, then tap to reveal and check yourself.
      </p>
    </HomeScreen>
  )
}
