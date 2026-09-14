'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, MicVocal } from 'lucide-react'
import { QariScreen } from '@/components/qari/QariShell'
import { fetchDiscover } from '@/lib/qari'
import { SHEIKHS } from '@/lib/sheikhs'

/** Every sheikh you can imitate, the most imitated first. */
export default function SheikhsPage() {
  const [counts, setCounts] = useState<Map<string, number> | null>(null)

  useEffect(() => {
    fetchDiscover()
      .then((d) => setCounts(new Map(d.sheikhs.map((s) => [s.id, s.count]))))
      .catch(() => setCounts(new Map()))
  }, [])

  const ordered = useMemo(
    () =>
      [...SHEIKHS].sort(
        (a, b) => (counts?.get(b.id) ?? 0) - (counts?.get(a.id) ?? 0) || a.shortName.localeCompare(b.shortName)
      ),
    [counts]
  )

  return (
    <QariScreen>
      <header className="flex items-center gap-1">
        <Link
          href="/qari"
          aria-label="Back"
          className="qari-press ed-focus -ml-2 flex h-11 w-10 shrink-0 items-center justify-center text-[var(--home-heading)]"
        >
          <ChevronLeft className="h-6 w-6" strokeWidth={2} />
        </Link>
        <h1 className="text-xl font-bold tracking-[-0.01em] text-[var(--home-heading)]">Sheikhs</h1>
      </header>
      <p className="mt-1 text-sm text-[var(--home-muted)]">Pick a sheikh to hear everyone who imitated him.</p>

      <div className="ed-card mt-4 overflow-hidden rounded-2xl">
        {ordered.map((sheikh, i) => {
          const count = counts?.get(sheikh.id) ?? 0
          return (
            <Link
              key={sheikh.id}
              href={`/qari/sheikh/${sheikh.id}`}
              className="qari-enter ed-focus flex min-h-[60px] items-center gap-3 border-b border-[var(--home-rule)] px-3.5 py-2.5 transition-colors last:border-b-0 hover:bg-[var(--home-track)]"
              style={{ animationDelay: `${Math.min(i, 12) * 25}ms` }}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--home-sage-soft)] text-[var(--home-sage)]">
                <MicVocal className="h-[18px] w-[18px]" strokeWidth={2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold text-[var(--home-heading)]">{sheikh.name}</span>
                <span className="block text-xs text-[var(--home-muted)]">
                  {counts === null ? ' ' : count === 0 ? 'No imitations yet' : `${count} imitation${count === 1 ? '' : 's'}`}
                </span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-[var(--home-muted)]" strokeWidth={2} />
            </Link>
          )
        })}
      </div>
    </QariScreen>
  )
}
