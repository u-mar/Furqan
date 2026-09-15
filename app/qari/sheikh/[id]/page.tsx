'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { Mic, MicVocal } from 'lucide-react'
import EmptyState from '@/components/qari/EmptyState'
import { PullIndicator, usePullToRefresh } from '@/components/qari/PullToRefresh'
import RecitationCard, { RecitationCards, RecitationSkeletons } from '@/components/qari/RecitationCard'
import { SheikhHeader } from '@/components/qari/SheikhCards'
import {
  QariHeader,
  QariLabel,
  QariScreen,
  QariSegmented,
  qariNotice,
  useViewer,
} from '@/components/qari/QariShell'
import { fetchFeed, fetchSheikhStats, type Recitation } from '@/lib/qari'
import { onPlayerError } from '@/lib/qari-player'
import { findSheikh } from '@/lib/sheikhs'

/** Every imitation of one sheikh, from everyone. */
export default function SheikhPage() {
  const params = useParams<{ id: string }>()
  const sheikh = findSheikh(String(params?.id ?? ''))
  const viewer = useViewer()
  const viewerId = viewer?.id ?? null

  const [sort, setSort] = useState<'top' | 'recent'>('top')
  const [items, setItems] = useState<Recitation[] | null>(null)
  const [stats, setStats] = useState<{ count: number; people: number } | null>(null)
  const loads = useRef(0)

  useEffect(() => onPlayerError(qariNotice), [])

  const load = useCallback(async () => {
    if (!sheikh) return
    const id = ++loads.current
    const [page, counts] = await Promise.all([
      fetchFeed({ imitating: sheikh.id, sort, viewerId, take: 50 }).catch(() => ({ items: [], hasMore: false })),
      fetchSheikhStats(sheikh.id),
    ])
    if (id !== loads.current) return
    setItems(page.items)
    setStats(counts)
  }, [sheikh, sort, viewerId])

  useEffect(() => {
    setItems(null)
    void load()
  }, [load])

  const { pull, refreshing } = usePullToRefresh(load)

  const onRemoved = useCallback((id: string) => {
    setItems((prev) => prev?.filter((r) => r.id !== id) ?? prev)
  }, [])

  return (
    <QariScreen>
      <PullIndicator pull={pull} refreshing={refreshing} />
      <QariHeader title={sheikh?.shortName ?? 'Imitations'} sub={sheikh ? 'Imitations' : undefined} />

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
          <div className="mt-[18px]">
            <SheikhHeader sheikh={sheikh} count={stats?.count ?? null} people={stats?.people ?? null} />
          </div>

          <QariLabel>Imitations</QariLabel>
          <QariSegmented
            label="Sort imitations"
            value={sort}
            onChange={setSort}
            options={[
              { id: 'top', label: 'Most loved' },
              { id: 'recent', label: 'Latest' },
            ]}
          />

          <div className="mt-3">
            {items === null ? (
              <RecitationSkeletons count={3} />
            ) : items.length === 0 ? (
              <EmptyState
                Icon={Mic}
                title={`No one has imitated ${sheikh.shortName} yet`}
                body="Be the first. Switch on Imitate when you record and pick him."
              />
            ) : (
              <RecitationCards>
                {items.map((recitation, i) => (
                  <RecitationCard
                    key={recitation.id}
                    recitation={recitation}
                    queue={items}
                    index={i}
                    viewerId={viewerId}
                    viewerUsername={viewer?.username ?? null}
                    onNotice={qariNotice}
                    onRemoved={onRemoved}
                  />
                ))}
              </RecitationCards>
            )}
          </div>
        </>
      )}
    </QariScreen>
  )
}
