'use client'

import Link from 'next/link'
import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { ChevronRight, SearchX, Send, UsersRound } from 'lucide-react'
import EmptyState from '@/components/qari/EmptyState'
import FollowButton from '@/components/qari/FollowButton'
import QariAvatar from '@/components/qari/QariAvatar'
import {
  QariHeader,
  QariScreen,
  QariSearch,
  qariNotice,
  useViewer,
} from '@/components/qari/QariShell'
import { fetchQaris, type QariSummary } from '@/lib/qari'
import { useBlockedUsers } from '@/lib/qari-blocks'
import { APP_NAME } from '@/lib/app-brand'
import { cn } from '@/lib/cn'
import { tapFeedback } from '@/lib/haptics'
import { tr, useT } from '@/lib/i18n'

type Tab = 'all' | 'following'

/** Find qaris and follow them. */
export default function QarisPage() {
  const t = useT()
  const viewer = useViewer()
  const [tab, setTab] = useState<Tab>('all')
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<QariSummary[] | null>(null)
  // Someone you blocked isn't offered here either.
  const blockedUsers = useBlockedUsers(viewer)
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

  /** The app's link, through the phone's own share sheet (copied where there is none). */
  const invite = useCallback(async () => {
    tapFeedback()
    const url = 'https://qurannaba.com/qari'
    const text = tr('Listen to recitations and share your own on {name}.', { name: APP_NAME })
    try {
      if (navigator.share) {
        await navigator.share({ title: APP_NAME, text, url })
        return
      }
      await navigator.clipboard.writeText(`${text}\n${url}`)
      qariNotice(tr('Link copied.'))
    } catch {
      // Closed without sharing.
    }
  }, [])

  return (
    <QariScreen>
      <QariHeader title={t('Qaris')} />

      <QariSearch className="mt-4" value={search} onChange={setSearch} placeholder={t('Search qaris')} label={t('Search qaris')} />

      {/* Two words with a line under the chosen one, as on TikTok. */}
      <div className="-mx-4 mt-3 flex border-b border-[var(--home-rule)]" role="tablist" aria-label={t('Which qaris')}>
        {(
          [
            { id: 'all', label: t('Suggested') },
            { id: 'following', label: t('Following') },
          ] as { id: Tab; label: string }[]
        ).map((option) => (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={tab === option.id}
            onClick={() => {
              if (tab === option.id) return
              tapFeedback()
              setTab(option.id)
            }}
            className={cn(
              'ed-focus relative h-11 flex-1 text-[15px] font-semibold transition-colors',
              tab === option.id ? 'text-[var(--home-heading)]' : 'text-[var(--home-muted)]'
            )}
          >
            {option.label}
            <span
              className={cn(
                'absolute -bottom-px left-1/2 h-[2.5px] w-11 -translate-x-1/2 rounded-full bg-[var(--home-heading)] transition-opacity',
                tab === option.id ? 'opacity-100' : 'opacity-0'
              )}
            />
          </button>
        ))}
      </div>

      {tab === 'all' && !query ? (
        <button type="button" onClick={() => void invite()} className="qari-press ed-focus mt-3 flex w-full items-center gap-3 rounded-2xl py-1.5 text-left">
          <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full bg-[var(--home-sage)] text-[var(--qari-on-teal)]">
            <Send className="h-[22px] w-[22px]" strokeWidth={2} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold text-[var(--home-heading)]">{t('Invite friends')}</span>
            <span className="mt-px block text-[12.5px] text-[var(--home-muted)]">{t('Share {name} with someone who recites', { name: APP_NAME })}</span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-[var(--home-muted)] rtl:rotate-180" strokeWidth={2} aria-hidden />
        </button>
      ) : null}

      <div className="mt-3">
        {items === null ? (
          <div aria-hidden>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 py-2" style={{ opacity: 1 - i * 0.18 }}>
                <span className="qari-skeleton h-[52px] w-[52px] rounded-full" />
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
            title={t('Could not load qaris')}
            body={t('Check your connection and try again.')}
            action={{ label: t('Try again'), onClick: () => void load() }}
          />
        ) : items.length === 0 ? (
          tab === 'following' && !query ? (
            <EmptyState
              Icon={UsersRound}
              title={viewer ? t('You are not following anyone yet') : t('Sign in to follow qaris')}
              body={t('Follow qaris you like and you can hear their new recitations first.')}
              action={viewer ? { label: t('See all qaris'), onClick: () => setTab('all') } : undefined}
            />
          ) : (
            <EmptyState Icon={SearchX} title={t('No qaris found')} body={t('Nobody matches “{query}”.', { query })} />
          )
        ) : (
          <div>
            {items.filter((q) => !blockedUsers.has(q.username.toLowerCase())).map((qari, i) => {
              const isMe = me === qari.username.toLowerCase()
              return (
                <Fragment key={qari.username}>
                  <div
                    className="qari-enter flex items-center gap-3 py-2"
                    style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}
                  >
                    <Link
                      href={`/qari/${encodeURIComponent(qari.username)}`}
                      className="ed-focus flex min-w-0 flex-1 items-center gap-3 rounded-2xl"
                    >
                      <QariAvatar username={qari.username} name={qari.name} size={52} />
                      <span className="min-w-0">
                        <span className="block truncate text-[15px] font-semibold text-[var(--home-heading)]">{qari.name}</span>
                        <span className="mt-px block truncate text-[12.5px] text-[var(--home-muted)]">
                          @{qari.username} · {qari.recitations} {qari.recitations === 1 ? 'recitation' : 'recitations'}
                        </span>
                      </span>
                    </Link>
                    {isMe ? (
                      <span className="px-2 text-[13px] font-semibold text-[var(--home-muted)]">{t('You')}</span>
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
