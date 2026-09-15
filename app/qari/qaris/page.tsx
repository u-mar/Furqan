'use client'

import Link from 'next/link'
import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { SearchX, UsersRound } from 'lucide-react'
import EmptyState from '@/components/qari/EmptyState'
import FollowButton from '@/components/qari/FollowButton'
import QariAvatar from '@/components/qari/QariAvatar'
import {
  QariHeader,
  QariScreen,
  QariSearch,
  QariSegmented,
  qariNotice,
  useViewer,
} from '@/components/qari/QariShell'
import { fetchQaris, type QariSummary } from '@/lib/qari'

type Tab = 'all' | 'following'

/** Find qaris and follow them. */
export default function QarisPage() {
  const viewer = useViewer()
  const [tab, setTab] = useState<Tab>('all')
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<QariSummary[] | null>(null)
  const [failed, setFailed] = useState(false)
  const loads = useRef(0)

  useEffect(() => {
    const id = window.setTimeout(() => setQuery(search.trim()), 250)
    return () => window.clearTimeout(id)
  }, [search])

  const load = useCallback(async () => {
    const id = ++loads.current
    setFailed(false)
    try {
      const list = await fetchQaris({ viewerId: viewer?.id ?? null, query, onlyFollowing: tab === 'following' })
      if (id === loads.current) setItems(list)
    } catch {
      if (id !== loads.current) return
      setFailed(true)
      setItems([])
    }
  }, [query, tab, viewer?.id])

  useEffect(() => {
    setItems(null)
    void load()
  }, [load])

  const me = viewer?.username.toLowerCase() ?? null

  return (
    <QariScreen>
      <QariHeader title="Qaris" />

      <QariSearch className="mt-4" value={search} onChange={setSearch} placeholder="Search qaris" label="Search qaris" />

      <QariSegmented
        className="mt-2.5"
        label="Which qaris"
        value={tab}
        onChange={setTab}
        options={[
          { id: 'all', label: 'All' },
          { id: 'following', label: 'Following' },
        ]}
      />

      <div className="mt-3">
        {items === null ? (
          <div className="home-card overflow-hidden rounded-2xl" aria-hidden>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex min-h-16 items-center gap-3 px-3.5 py-2.5" style={{ opacity: 1 - i * 0.18 }}>
                <span className="qari-skeleton h-11 w-11 rounded-full" />
                <span className="flex-1 space-y-2">
                  <span className="qari-skeleton block h-3.5 w-1/2 rounded-full" />
                  <span className="qari-skeleton block h-3 w-1/3 rounded-full" />
                </span>
                <span className="qari-skeleton h-[34px] w-[4.5rem] rounded-full" />
              </div>
            ))}
          </div>
        ) : failed ? (
          <EmptyState
            Icon={UsersRound}
            title="Could not load qaris"
            body="Check your connection and try again."
            action={{ label: 'Try again', onClick: () => void load() }}
          />
        ) : items.length === 0 ? (
          tab === 'following' && !query ? (
            <EmptyState
              Icon={UsersRound}
              title={viewer ? 'You are not following anyone yet' : 'Sign in to follow qaris'}
              body="Follow qaris you like and you can hear their new recitations first."
              action={viewer ? { label: 'See all qaris', onClick: () => setTab('all') } : undefined}
            />
          ) : (
            <EmptyState Icon={SearchX} title="No qaris found" body={`Nobody matches “${query}”.`} />
          )
        ) : (
          <div className="home-card overflow-hidden rounded-2xl">
            {items.map((qari, i) => {
              const isMe = me === qari.username.toLowerCase()
              return (
                <Fragment key={qari.username}>
                  {i > 0 ? <div className="set-row__divider" style={{ marginLeft: '4.375rem' }} /> : null}
                  <div
                    className="qari-enter flex min-h-16 items-center gap-3 py-2.5 pl-3.5 pr-3"
                    style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}
                  >
                    <Link
                      href={`/qari/${encodeURIComponent(qari.username)}`}
                      className="ed-focus flex min-w-0 flex-1 items-center gap-3 rounded-2xl"
                    >
                      <QariAvatar username={qari.username} name={qari.name} size={44} />
                      <span className="min-w-0">
                        <span className="block truncate text-[15px] font-semibold text-[var(--home-heading)]">{qari.name}</span>
                        <span className="mt-px block truncate text-[12.5px] text-[var(--home-muted)]">
                          @{qari.username} · {qari.recitations} {qari.recitations === 1 ? 'recitation' : 'recitations'}
                        </span>
                      </span>
                    </Link>
                    {isMe ? (
                      <span className="px-2 text-[13px] font-semibold text-[var(--home-muted)]">You</span>
                    ) : (
                      <FollowButton
                        viewer={viewer}
                        target={qari.username}
                        following={qari.following}
                        onNotice={qariNotice}
                        onChange={({ following }) =>
                          setItems((prev) =>
                            prev?.map((q) => (q.username === qari.username ? { ...q, following } : q)) ?? prev
                          )
                        }
                      />
                    )}
                  </div>
                </Fragment>
              )
            })}
          </div>
        )}
      </div>
    </QariScreen>
  )
}
