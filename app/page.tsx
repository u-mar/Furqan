'use client'

import TestScopeSelector from '@/components/TestScopeSelector'
import ThemeToggle from '@/components/ThemeToggle'
import WeakAyahsList from '@/components/WeakAyahsList'

export default function Home() {
  return (
    <main className="min-h-screen bg-[var(--hifdh-bg)] text-[var(--hifdh-text)]">
      <div className="mx-auto max-w-lg px-4 py-8">
        <header className="mb-8 flex items-center justify-between">
          <h1 className="font-serif text-xl font-medium tracking-tight text-[var(--hifdh-text)]">
            Hifdh Practice
          </h1>
          <div className="flex items-center gap-2">
            <span className="arabic-text text-2xl text-teal-700 !leading-none dark:text-teal-300" dir="rtl" aria-hidden>
              حفظ
            </span>
            <ThemeToggle />
          </div>
        </header>

        <p className="mb-6 text-center text-[15px] text-[var(--hifdh-muted)]">
          A random verse is highlighted on a Quran page — tap to reveal the next ayah and test your memory.
        </p>

        <div className="space-y-3">
          <TestScopeSelector />
          <WeakAyahsList />
        </div>
      </div>
    </main>
  )
}
