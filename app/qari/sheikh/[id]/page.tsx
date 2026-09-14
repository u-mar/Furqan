'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { ChevronLeft, Clock, Heart, Mic, MicVocal } from 'lucide-react'
import Dropdown from '@/components/qari/Dropdown'
import EmptyState from '@/components/qari/EmptyState'
import { PullIndicator, usePullToRefresh } from '@/components/qari/PullToRefresh'
import RecitationRow from '@/components/qari/RecitationRow'
import SectionHeader from '@/components/qari/SectionHeader'
import { SheikhHeader } from '@/components/qari/SheikhCards'
import SkeletonRows from '@/components/qari/SkeletonRows'
import { Notice, QariScreen, useNotice, useViewer } from '@/components/qari/QariShell'
import { fetchFeed, fetchSheikhStats, type Recitation } from '@/lib/qari'
import { onPlayerError } from '@/lib/qari-player'
import { findSheikh } from '@/lib/sheikhs'

/** Every imitation of one sheikh, from everyone. */
export default function SheikhPage() {
  const params = useParams<{ id: string }>()
  const sheikh = findSheikh(String(params?.id ?? ''))
  const viewer = useViewer()
  const viewerId = viewer?.id ?? null
  const { notice, setNotice } = useNotice()

  const [sort, setSort] = useState<'top' | 'recent'>('top')
  const [items, setItems] = useState<Recitation[] | null>(null)
  const [stats, setStats] = useState<{ count: number; people: number } | null>(null)

  useEffect(() => onPlayerError(setNotice), [setNotice])

  const load = useCallback(async () => {
    if (!sheikh) return
    const [page, counts] = await Promise.all([
      fetchFeed({ imitating: sheikh.id, sort, viewerId, take: 50 }).catch(() => ({ items: [], hasMore: false })),
      fetchSheikhStats(sheikh.id),
    ])
    setItems(page.items)
    setStats(counts)
  }, [sheikh, sort, viewerId])

  useEffect(() => {
    setItems(null)
    void load()
  }, [load])

  const { pull, refreshing } = usePullToRefresh(load)

  return (
    <QariScreen>
      <PullIndicator pull={pull} refreshing={refreshing} />
      <header className="flex items-center gap-1">
        <Link
          href="/qari"
          aria-label="Back"
          className="qari-press ed-focus -ml-2 flex h-11 w-10 shrink-0 items-center justify-center text-[var(--home-heading)]"
        >
          <ChevronLeft className="h-6 w-6" strokeWidth={2} />
        </Link>
        <h1 className="text-xl font-bold tracking-[-0.01em] text-[var(--home-heading)]">Imitations</h1>
      </header>

      {!sheikh ? (
        <div className="mt-6">
          <EmptyState
            Icon={MicVocal}
            title="Sheikh not found"
            body="This page may have moved. Search for the sheikh from Qari."
            action={{ label: 'Back to Qari', href: '/qari' }}
          />
        </div>
      ) : (
        <>
          <div className="mt-4">
            <SheikhHeader sheikh={sheikh} count={stats?.count ?? null} people={stats?.people ?? null} />
          </div>

          <SectionHeader
            title="Imitations"
            action={
              <Dropdown
                label="Sort"
                value={sort}
                onChange={setSort}
                options={[
                  { id: 'top', label: 'Most loved', Icon: Heart },
                  { id: 'recent', label: 'Latest', Icon: Clock },
                ]}
              />
            }
          />

          {items === null ? (
            <SkeletonRows count={4} />
          ) : items.length === 0 ? (
            <EmptyState
              Icon={Mic}
              title={`No one has imitated ${sheikh.shortName} yet`}
              body="Be the first. Switch on Imitate when you record and pick him."
              action={{ label: `Imitate ${sheikh.shortName}`, href: `/qari/record?imitate=${sheikh.id}`, Icon: Mic }}
            />
          ) : (
            <div>
              {items.map((recitation, i) => (
                <RecitationRow
                  key={recitation.id}
                  recitation={recitation}
                  queue={items}
                  index={i}
                  viewerId={viewerId}
                  viewerUsername={viewer?.username ?? null}
                  onNotice={setNotice}
                  onRemoved={(id) => setItems((prev) => prev?.filter((r) => r.id !== id) ?? prev)}
                />
              ))}
            </div>
          )}
        </>
      )}

      <Notice message={notice} />
    </QariScreen>
  )
}
