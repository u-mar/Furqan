'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { House, Plus, UserRound } from 'lucide-react'
import QariAvatar from '@/components/qari/QariAvatar'
import AccountSheet from '@/components/settings/AccountSheet'
import { useViewer } from '@/hooks/useViewer'
import { cn } from '@/lib/cn'

/**
 * The bar along the bottom of every Qari screen: the feed, a button to add a
 * recitation, and your own profile.
 *
 * Hidden while recording — that screen is a single task with its own way
 * out, and the bar would only invite you to abandon a take mid-recitation.
 */
export default function QariTabBar() {
  const pathname = usePathname()
  const viewer = useViewer()
  const [accountOpen, setAccountOpen] = useState(false)

  if (pathname === '/qari/record') return null

  const onFeed = pathname === '/qari'
  const myProfile = viewer ? `/qari/${encodeURIComponent(viewer.username)}` : null
  const onMyProfile = Boolean(myProfile && pathname === myProfile)

  return (
    <>
      <nav className="qari-tabbar" aria-label="Qari">
        <div className="qari-tabbar__inner">
          <Link
            href="/qari"
            aria-current={onFeed ? 'page' : undefined}
            className={cn('qari-tabbar__item ed-focus', onFeed && 'is-active')}
          >
            <House className="h-[22px] w-[22px]" strokeWidth={onFeed ? 2.2 : 1.9} />
            Home
          </Link>

          <Link
            href="/qari/record"
            aria-label="Add a recitation"
            className="qari-tabbar__add ed-focus"
          >
            <Plus className="h-6 w-6" strokeWidth={2.6} />
          </Link>

          {viewer && myProfile ? (
            <Link
              href={myProfile}
              aria-current={onMyProfile ? 'page' : undefined}
              className={cn('qari-tabbar__item ed-focus', onMyProfile && 'is-active')}
            >
              <QariAvatar
                username={viewer.username}
                name={viewer.name}
                size={22}
                className={cn('qari-tabbar__avatar', onMyProfile && 'is-active')}
              />
              Profile
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setAccountOpen(true)}
              className="qari-tabbar__item ed-focus"
            >
              <UserRound className="h-[22px] w-[22px]" strokeWidth={1.9} />
              Profile
            </button>
          )}
        </div>
      </nav>

      <AccountSheet open={accountOpen} onClose={() => setAccountOpen(false)} onSuccess={() => {}} />
    </>
  )
}
