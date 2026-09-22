'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Bell, BellOff, Heart, TrendingUp, UserPlus } from 'lucide-react'
import EmptyState from '@/components/qari/EmptyState'
import QariAvatar from '@/components/qari/QariAvatar'
import { QariHeader, QariScreen, useViewer } from '@/components/qari/QariShell'
import { askToSignIn } from '@/lib/account-prompt'
import { tapFeedback } from '@/lib/haptics'
import { timeAgo } from '@/lib/qari'
import { fetchNotifications, markNotificationsRead, type QariNotification } from '@/lib/qari-notifications'
import { disablePush, enablePush, pushState, syncPush, type PushState } from '@/lib/push-client'
import { cn } from '@/lib/cn'
import { useT } from '@/lib/i18n'

export default function NotificationsPage() {
  const t = useT()
  const viewer = useViewer()
  const [items, setItems] = useState<QariNotification[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [push, setPush] = useState<PushState | null>(null)
  const [pushBusy, setPushBusy] = useState(false)

  const id = viewer?.id
  const username = viewer?.username

  useEffect(() => {
    if (!id || !username) return
    let cancelled = false
    fetchNotifications({ id, username })
      .then((list) => {
        if (cancelled) return
        // What is new stays marked while the list is open; the badge clears at once.
        setItems(list)
        if (list.some((n) => !n.read)) void markNotificationsRead({ id, username })
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [id, username])

  // Whether this phone gets them when the app is closed; where it already does, keep the server's copy of the phone fresh.
  useEffect(() => {
    if (!id || !username) return
    void pushState().then((state) => {
      setPush(state)
      if (state === 'on') void syncPush({ id, username })
    })
  }, [id, username])

  const togglePush = async () => {
    if (!id || !username || pushBusy) return
    tapFeedback()
    setPushBusy(true)
    try {
      setPush(push === 'on' ? await disablePush({ id, username }) : await enablePush({ id, username }))
    } finally {
      setPushBusy(false)
    }
  }

  return (
    <QariScreen>
      <QariHeader title={t('Notifications')} />

      {viewer && push && push !== 'unconfigured' ? (
        <div className="home-card mt-4 flex items-center gap-3 rounded-2xl px-3.5 py-3">
          <span className="set-row__icon" aria-hidden>
            {push === 'on' ? <Bell className="h-[17px] w-[17px]" strokeWidth={1.9} /> : <BellOff className="h-[17px] w-[17px]" strokeWidth={1.9} />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[0.9375rem] font-semibold text-[var(--home-heading)]">
              {push === 'on' ? t('Notifications are on for this phone') : t('Get notified on this phone')}
            </span>
            <span className="block text-[0.78125rem] leading-snug text-[var(--home-muted)]">
              {push === 'needs-install'
                ? t('On iPhone, first add this app to your Home Screen (Share, then Add to Home Screen), then open it from there.')
                : push === 'blocked'
                  ? t('Notifications are blocked. Allow them for this app in your phone’s settings.')
                  : push === 'unsupported'
                    ? t('This browser cannot show notifications when it is closed.')
                    : t('Hear about likes and new followers even when the app is closed.')}
            </span>
          </span>
          {push === 'off' || push === 'on' ? (
            <button
              type="button"
              onClick={() => void togglePush()}
              disabled={pushBusy}
              className={cn(
                'qari-press ed-focus h-9 shrink-0 rounded-full px-4 text-[0.8125rem] font-semibold disabled:opacity-60',
                push === 'on' ? 'border border-[var(--home-rule-strong)] text-[var(--home-heading)]' : 'ed-ink'
              )}
            >
              {push === 'on' ? t('Turn off') : t('Turn on')}
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 pb-6">
        {!viewer ? (
          <EmptyState
            Icon={Bell}
            title={t('Sign in to see your notifications')}
            body={t('You will hear here when someone likes your recitation or follows you.')}
            action={{ label: t('Sign in'), onClick: () => askToSignIn({ reason: t('Create a free account to get notifications.') }) }}
          />
        ) : failed ? (
          <EmptyState
            Icon={Bell}
            title={t('Could not load notifications')}
            body={t('Check your connection and try again.')}
            action={{ label: t('Try again'), onClick: () => window.location.reload() }}
          />
        ) : items === null ? (
          <div className="space-y-2.5" aria-busy>
            {[0, 1, 2].map((i) => (
              <div key={i} className="qari-skeleton h-[68px] rounded-2xl" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            Icon={Bell}
            title={t('Nothing yet')}
            body={t('When someone likes your recitation or follows you, you will see it here.')}
            action={{ label: t('Record a recitation'), href: '/qari/record' }}
          />
        ) : (
          <ul className="home-card divide-y divide-[var(--home-rule)] overflow-hidden rounded-2xl">
            {items.map((n) => {
              const like = n.type === 'like'
              const milestone = n.type === 'milestone'
              const href = milestone || like
                ? `/qari/${encodeURIComponent(viewer.username)}`
                : `/qari/${encodeURIComponent(n.actorUsername)}`
              return (
                <li key={n.id}>
                  <Link
                    href={href}
                    onClick={tapFeedback}
                    className={cn('ed-focus flex items-center gap-3 px-3.5 py-3', !n.read && 'bg-[var(--home-sage-soft)]')}
                  >
                    {milestone ? (
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--home-sage-soft)] text-[var(--home-sage-deep)]">
                        <TrendingUp className="h-[19px] w-[19px]" strokeWidth={2.1} />
                      </span>
                    ) : (
                      <span className="relative shrink-0">
                        <QariAvatar username={n.actorUsername} name={n.actorName} size={44} />
                        <span className="absolute -bottom-1 -right-1 flex h-[20px] w-[20px] items-center justify-center rounded-full bg-[var(--home-heading)] text-[var(--app-bg)] ring-2 ring-[var(--app-bg)]">
                          {like ? (
                            <Heart className="h-[11px] w-[11px] fill-current" strokeWidth={0} />
                          ) : (
                            <UserPlus className="h-[11px] w-[11px]" strokeWidth={2.4} />
                          )}
                        </span>
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block text-[0.9375rem] leading-snug text-[var(--home-heading)]">
                        {milestone ? (
                          n.milestoneKind === 'plays'
                            ? t('“{title}” just passed {count} plays', { title: n.recitationTitle ?? t('Your recitation'), count: n.milestoneCount ?? 0 })
                            : t('“{title}” just passed {count} likes', { title: n.recitationTitle ?? t('Your recitation'), count: n.milestoneCount ?? 0 })
                        ) : (
                          <>
                            <span className="font-semibold">{n.actorName}</span>{' '}
                            {like
                              ? n.recitationTitle
                                ? t('liked your recitation “{title}”', { title: n.recitationTitle })
                                : t('liked your recitation')
                              : t('started following you')}
                          </>
                        )}
                      </span>
                      <span className="mt-0.5 block text-[0.78125rem] text-[var(--home-muted)]">{timeAgo(n.createdAt)}</span>
                    </span>
                    {!n.read ? <span className="h-2 w-2 shrink-0 rounded-full bg-rose-600" aria-label={t('New')} /> : null}
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </QariScreen>
  )
}
