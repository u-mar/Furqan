'use client'

import Link from 'next/link'
import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { Link2, MessageCircle, MessageSquareText, MoreHorizontal, SearchX, UsersRound, type LucideIcon } from 'lucide-react'
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
    try {
      if (navigator.share) {
        await navigator.share({ title: APP_NAME, text: inviteText(), url: INVITE_URL })
        return
      }
      await navigator.clipboard.writeText(`${inviteText()}\n${INVITE_URL}`)
      qariNotice(tr('Link copied.'))
    } catch {
      // Closed without sharing.
    }
  }, [])

  const copyInvite = useCallback(async () => {
    tapFeedback()
    try {
      await navigator.clipboard.writeText(`${inviteText()}\n${INVITE_URL}`)
      qariNotice(tr('Link copied.'))
    } catch {
      qariNotice(tr('Could not copy the link.'))
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
        // The link to the app, one tap from the apps people send it with most, as on TikTok.
        <section className="mt-4" aria-label={t('Invite friends')}>
          <h2 className="mb-2.5 text-[0.9375rem] font-semibold text-[var(--home-heading)]">{t('Invite friends')}</h2>
          <div className="flex justify-between gap-2">
            <InviteTarget
              icon={MessageCircle}
              tone="#25d366"
              label="WhatsApp"
              href={`https://wa.me/?text=${encodeURIComponent(`${inviteText()}\n${INVITE_URL}`)}`}
            />
            <InviteTarget
              icon={MessageSquareText}
              tone="#1d9bf0"
              label={t('SMS')}
              href={`sms:?body=${encodeURIComponent(`${inviteText()} ${INVITE_URL}`)}`}
            />
            <InviteTarget icon={Link2} label={t('Copy link')} onClick={() => void copyInvite()} />
            <InviteTarget icon={MoreHorizontal} label={t('More')} onClick={() => void invite()} />
          </div>
          <h2 className="mt-5 text-[0.9375rem] font-semibold text-[var(--home-heading)]">{t('Suggested qaris')}</h2>
        </section>
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

const INVITE_URL = 'https://qurannaba.com/qari'

function inviteText(): string {
  return tr('Listen to recitations and share your own on {name}.', { name: APP_NAME })
}

/** One way to send the invite: a round button in that app's colour (or the page's), its name beneath. */
function InviteTarget({
  icon: Icon,
  label,
  tone,
  href,
  onClick,
}: {
  icon: LucideIcon
  label: string
  tone?: string
  href?: string
  onClick?: () => void
}) {
  const body = (
    <>
      <span
        className="flex h-12 w-12 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--home-heading)_9%,transparent)] text-[var(--home-heading)]"
        style={tone ? { background: tone, color: '#ffffff' } : undefined}
      >
        <Icon className="h-[22px] w-[22px]" strokeWidth={1.9} />
      </span>
      <span className="text-[0.75rem] font-medium text-[var(--home-heading)]">{label}</span>
    </>
  )
  const className = 'qari-press ed-focus flex w-[4.25rem] flex-col items-center gap-1.5 rounded-xl'
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className} onClick={() => tapFeedback()}>
      {body}
    </a>
  ) : (
    <button type="button" onClick={onClick} className={className}>
      {body}
    </button>
  )
}
