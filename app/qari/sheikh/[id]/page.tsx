'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { MicVocal } from 'lucide-react'
import EmptyState from '@/components/qari/EmptyState'
import { PullIndicator, usePullToRefresh } from '@/components/qari/PullToRefresh'
import RecitationCard, { RecitationCards, RecitationSkeletons } from '@/components/qari/RecitationCard'
import { SheikhHeader } from '@/components/qari/SheikhCards'
import { QariChips, QariHeader, QariScreen, qariNotice, useViewer } from '@/components/qari/QariShell'
import { fetchFeed, fetchSheikhStats, peekFeed, type Recitation } from '@/lib/qari'
import { onPlayerError } from '@/lib/qari-player'
import { findSheikh } from '@/lib/sheikhs'
import { useT } from '@/lib/i18n'

/** Every imitation of one sheikh, from everyone. */
export default function SheikhPage() {
  const t = useT()
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
    setItems(sheikh ? (peekFeed({ imitating: sheikh.id, sort, viewerId, take: 50 })?.items ?? null) : null)
    void load()
  }, [load])

  const { pull, refreshing } = usePullToRefresh(load)

  const onRemoved = useCallback((id: string) => {
    setItems((prev) => prev?.filter((r) => r.id !== id) ?? prev)
  }, [])

  // Shared with everyone, so a recitation made private drops out of it.
  const onPrivacyChanged = useCallback(
    (id: string, patch: Partial<Recitation>) => {
      if (patch.isPrivate) onRemoved(id)
    },
    [onRemoved]
  )

  return (
    <QariScreen>
      <PullIndicator pull={pull} refreshing={refreshing} />
      {/* The card below carries his name, so the header is only the way back. */}
      <QariHeader title={t('Imitations')} />

      {!sheikh ? (
        <div className="mt-6">
          <EmptyState
            Icon={MicVocal}
            title={t('Sheikh not found')}
            body={t('This page may have moved. Search for the sheikh from Qari.')}
            action={{ label: t('Back to Qari'), href: '/qari' }}
          />
        </div>
      ) : (
        <>
          <div className="mt-4">
            <SheikhHeader sheikh={sheikh} count={stats?.count ?? null} people={stats?.people ?? null} />
          </div>

          {/* Nothing to sort until someone has imitated him — and the card above
              already says so, with the button to be the first. */}
          {items && items.length > 0 ? (
            <QariChips
              className="mt-6"
              label={t('Sort imitations')}
              value={sort}
              onChange={setSort}
              options={[
                { id: 'top', label: t('Most loved') },
                { id: 'recent', label: t('Latest') },
              ]}
            />
          ) : null}

          <div className="mt-3">
            {items === null ? (
              <div className="mt-6">
                <RecitationSkeletons count={3} />
              </div>
            ) : items.length === 0 ? null : (
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
                    onUpdated={onPrivacyChanged}
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
