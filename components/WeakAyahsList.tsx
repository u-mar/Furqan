'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, RefreshCw } from 'lucide-react'
import type { Session } from '@/types'
import { getWeakAyahs } from '@/lib/session'
import { cn } from '@/lib/cn'
import Button from '@/components/ui/Button'

export default function WeakAyahsList() {
  const [weakAyahs, setWeakAyahs] = useState<Session[]>([])
  const [open, setOpen] = useState(false)

  const refresh = () => setWeakAyahs(getWeakAyahs())

  useEffect(() => {
    refresh()
  }, [])

  return (
    <section className="rounded-2xl border border-[var(--hifdh-border)] bg-[var(--hifdh-surface)] p-5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[var(--hifdh-text)]">Weak ayahs</span>
          <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700 dark:bg-red-400/10 dark:text-red-300">
            {weakAyahs.length}
          </span>
        </div>
        <ChevronDown
          className={cn('h-4 w-4 text-[var(--hifdh-hint)] transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </button>

      <div
        className={cn(
          'overflow-hidden transition-all duration-200 motion-reduce:transition-none',
          open ? 'mt-4 max-h-[28rem]' : 'max-h-0'
        )}
      >
        {weakAyahs.length === 0 ? (
          <p className="text-[13px] text-[var(--hifdh-muted)]">
            No weak ayahs yet. Keep practicing — scores below 80% show up here.
          </p>
        ) : (
          <ul className="space-y-2">
            {weakAyahs.map((session) => (
              <li
                key={session.id}
                className="flex items-center justify-between rounded-lg bg-stone-50 px-3 py-2.5 dark:bg-stone-900"
              >
                <div>
                  <div className="text-sm font-medium text-[var(--hifdh-text)]">
                    {session.verseKey}
                  </div>
                  <div className="text-xs text-[var(--hifdh-muted)]">
                    {new Date(session.timestamp).toLocaleDateString()}
                  </div>
                </div>
                <div className="text-base font-semibold tabular-nums text-red-600 dark:text-red-300">
                  {session.score}%
                </div>
              </li>
            ))}
          </ul>
        )}

        <Button
          variant="ghost"
          size="sm"
          type="button"
          className="mt-3 w-full text-stone-500"
          onClick={refresh}
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          Refresh list
        </Button>
      </div>
    </section>
  )
}
