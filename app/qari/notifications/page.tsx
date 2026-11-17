'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { BadgeCheck, Bell, BellOff, Heart, TrendingUp, UserPlus } from 'lucide-react'
import EmptyState from '@/components/qari/EmptyState'
import FollowButton from '@/components/qari/FollowButton'
import QariAvatar from '@/components/qari/QariAvatar'
import { QariHeader, QariScreen, useViewer } from '@/components/qari/QariShell'
import { askToSignIn } from '@/lib/account-prompt'
import type { AppUser } from '@/lib/auth'
import { tapFeedback } from '@/lib/haptics'
import { fetchFollowState, timeAgo } from '@/lib/qari'
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

  // As an activity page lists them: what is new, then by how long ago.
  const sections = useMemo(() => {
    const now = Date.now()
    const day = 24 * 60 * 60 * 1000
    const groups: { id: string; label: string; items: QariNotification[] }[] = [
      { id: 'new', label: t('New'), items: [] },
      { id: 'today', label: t('Today'), items: [] },
      { id: 'week', label: t('This week'), items: [] },
      { id: 'earlier', label: t('Earlier'), items: [] },
    ]
    for (const n of items ?? []) {
      const age = now - new Date(n.createdAt).getTime()
      groups[!n.read ? 0 : age < day ? 1 : age < 7 * day ? 2 : 3].items.push(n)
    }
    return groups.filter((group) => group.items.length > 0)
  }, [items, t])

  // Whether each new follower is followed back, for the button beside them.
  const [follows, setFollows] = useState<Record<string, boolean>>({})
  useEffect(() => {
    if (!id || !items) return
    let cancelled = false
    const actors = [...new Set(items.filter((n) => n.type === 'follow').map((n) => n.actorUsername.toLowerCase()))].slice(0, 20)
    void Promise.all(actors.map(async (actor) => [actor, (await fetchFollowState(actor, id)).following] as const)).then((pairs) => {
      if (!cancelled) setFollows(Object.fromEntries(pairs))
    })
    return () => {
      cancelled = true
    }
  }, [id, items])

  return (
    <QariScreen>
      <QariHeader title={t('Notifications')} />

      {viewer && push && push !== 'unconfigured' ? (
        <div className="mt-3 flex items-center gap-3 rounded-2xl bg-[color-mix(in_srgb,var(--home-heading)_5%,transparent)] px-3.5 py-3">
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
          <div>
            {sections.map((section) => (
              <section key={section.id} className="mt-1 first:mt-0">
                <h2 className="px-1 pb-1.5 pt-3 text-[0.9375rem] font-semibold text-[var(--home-heading)]">{section.label}</h2>
                <ul>
                  {section.items.map((n) => (
                    <ActivityRow
                      key={n.id}
                      n={n}
                      viewer={viewer}
                      following={follows[n.actorUsername.toLowerCase()]}
                      onFollowed={(on) => setFollows((prev) => ({ ...prev, [n.actorUsername.toLowerCase()]: on }))}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </QariScreen>
  )
}

/** One line of activity: who, what they did and when; a new follower can be followed back from here. */
function ActivityRow({
  n,
  viewer,
  following,
  onFollowed,
}: {
  n: QariNotification
  viewer: AppUser
  following: boolean | undefined
  onFollowed: (on: boolean) => void
}) {
  const t = useT()
  const like = n.type === 'like'
  const milestone = n.type === 'milestone'
  const verification = n.type === 'verified' || n.type === 'verify-declined'
  const href =
    milestone || like || verification ? `/qari/${encodeURIComponent(viewer.username)}` : `/qari/${encodeURIComponent(n.actorUsername)}`
  return (
    <li className="flex items-center gap-3 px-1 py-2.5">
      <Link href={href} onClick={tapFeedback} className="ed-focus flex min-w-0 flex-1 items-center gap-3 rounded-xl">
        {verification ? (
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--qari-verified,#1d9bf0)_14%,transparent)]">
            <BadgeCheck
              className="h-6 w-6 text-[var(--app-bg)]"
              fill={n.type === 'verified' ? 'var(--qari-verified, #1d9bf0)' : 'var(--home-muted)'}
              strokeWidth={2.1}
            />
          </span>
        ) : milestone ? (
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--home-sage-soft)] text-[var(--home-sage-deep)]">
            <TrendingUp className="h-5 w-5" strokeWidth={2.1} />
          </span>
        ) : (
          <span className="relative shrink-0">
            <QariAvatar username={n.actorUsername} name={n.actorName} size={48} />
            <span
              className={cn(
                'absolute -bottom-0.5 -right-0.5 flex h-[20px] w-[20px] items-center justify-center rounded-full text-white ring-2 ring-[var(--app-bg)]',
                like ? 'bg-[#fe2c55]' : 'bg-[#20a4f3]'
              )}
            >
              {like ? <Heart className="h-[11px] w-[11px] fill-current" strokeWidth={0} /> : <UserPlus className="h-[11px] w-[11px]" strokeWidth={2.6} />}
            </span>
          </span>
        )}
        <span className="min-w-0 flex-1 text-[0.9375rem] leading-snug text-[var(--home-heading)]">
          {n.type === 'verified' ? (
            t('You are now a verified reciter. Your badge is on your profile.')
          ) : n.type === 'verify-declined' ? (
            t('Your verification request was not approved this time. You can apply again from your profile.')
          ) : milestone ? (
            n.milestoneKind === 'plays'
              ? t('“{title}” just passed {count} plays', { title: n.recitationTitle ?? t('Your recitation'), count: n.milestoneCount ?? 0 })
              : t('“{title}” just passed {count} likes', { title: n.recitationTitle ?? t('Your recitation'), count: n.milestoneCount ?? 0 })
          ) : (
            <>
              <span className="font-semibold">{n.actorName}</span>{' '}
              <span className="text-[color-mix(in_srgb,var(--home-heading)_82%,transparent)]">
                {like
                  ? n.recitationTitle
                    ? t('liked your recitation “{title}”', { title: n.recitationTitle })
                    : t('liked your recitation')
                  : t('started following you')}
              </span>
            </>
          )}{' '}
          <span className="whitespace-nowrap text-[0.8125rem] text-[var(--home-muted)]">{timeAgo(n.createdAt)}</span>
        </span>
      </Link>
      {n.type === 'follow' && following !== undefined ? (
        <FollowButton viewer={viewer} target={n.actorUsername} following={following} onChange={(state) => onFollowed(state.following)} />
      ) : !n.read ? (
        <span className="h-2 w-2 shrink-0 rounded-full bg-[#fe2c55]" aria-label={t('New')} />
      ) : null}
    </li>
  )
}
