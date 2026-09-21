'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Bell, Heart, UserPlus } from 'lucide-react'
import EmptyState from '@/components/qari/EmptyState'
import QariAvatar from '@/components/qari/QariAvatar'
import { QariHeader, QariScreen, useViewer } from '@/components/qari/QariShell'
import { askToSignIn } from '@/lib/account-prompt'
import { tapFeedback } from '@/lib/haptics'
import { timeAgo } from '@/lib/qari'
import { fetchNotifications, markNotificationsRead, type QariNotification } from '@/lib/qari-notifications'
import { cn } from '@/lib/cn'
import { useT } from '@/lib/i18n'

export default function NotificationsPage() {
  const t = useT()
  const viewer = useViewer()
  const [items, setItems] = useState<QariNotification[] | null>(null)
  const [failed, setFailed] = useState(false)

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

  return (
    <QariScreen>
      <QariHeader title={t('Notifications')} />

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
              const href = like ? `/qari/${encodeURIComponent(viewer.username)}` : `/qari/${encodeURIComponent(n.actorUsername)}`
              return (
                <li key={n.id}>
                  <Link
                    href={href}
                    onClick={tapFeedback}
                    className={cn('ed-focus flex items-center gap-3 px-3.5 py-3', !n.read && 'bg-[var(--home-sage-soft)]')}
                  >
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
                    <span className="min-w-0 flex-1">
                      <span className="block text-[0.9375rem] leading-snug text-[var(--home-heading)]">
                        <span className="font-semibold">{n.actorName}</span>{' '}
                        {like
                          ? n.recitationTitle
                            ? t('liked your recitation “{title}”', { title: n.recitationTitle })
                            : t('liked your recitation')
                          : t('started following you')}
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
