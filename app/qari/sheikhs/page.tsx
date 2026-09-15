'use client'

import Link from 'next/link'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { plural, SheikhMonogram } from '@/components/qari/SheikhCards'
import { QariHeader, QariScreen } from '@/components/qari/QariShell'
import { tapFeedback } from '@/lib/haptics'
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
      <QariHeader title="Sheikhs" sub="Hear everyone who imitated him" />

      <div className="home-card mt-[18px] overflow-hidden rounded-2xl">
        {ordered.map((sheikh, i) => {
          const count = counts?.get(sheikh.id) ?? 0
          return (
            <Fragment key={sheikh.id}>
              {i > 0 ? <div className="set-row__divider" style={{ marginLeft: '4.125rem' }} /> : null}
              <Link
                href={`/qari/sheikh/${sheikh.id}`}
                onClick={tapFeedback}
                className="set-row qari-enter"
                style={{ minHeight: '3.875rem', animationDelay: `${Math.min(i, 12) * 25}ms` }}
              >
                <SheikhMonogram sheikh={sheikh} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">{sheikh.name}</span>
                  <span className="mt-px block min-h-4 text-[12.5px] text-[var(--home-muted)]">
                    {counts === null ? '' : count === 0 ? 'No imitations yet' : plural(count, 'imitation')}
                  </span>
                </span>
                <ChevronRight className="h-[17px] w-[17px] shrink-0 text-[var(--home-muted)]" strokeWidth={2} />
              </Link>
            </Fragment>
          )
        })}
      </div>
    </QariScreen>
  )
}
