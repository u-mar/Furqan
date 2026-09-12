'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { House, Plus, UserRound } from 'lucide-react'
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
            aria-label="Home"
            className={cn('qari-tabbar__item ed-focus', onFeed && 'is-active')}
          >
            <House className="h-[23px] w-[23px]" strokeWidth={onFeed ? 2.3 : 1.9} />
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
              aria-label="Your profile"
              className={cn('qari-tabbar__item ed-focus', onMyProfile && 'is-active')}
            >
              <UserRound
                className="h-[23px] w-[23px]"
                strokeWidth={onMyProfile ? 2.3 : 1.9}
              />
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setAccountOpen(true)}
              aria-label="Sign in"
              className="qari-tabbar__item ed-focus"
            >
              <UserRound className="h-[23px] w-[23px]" strokeWidth={1.9} />
            </button>
          )}
        </div>
      </nav>

      <AccountSheet open={accountOpen} onClose={() => setAccountOpen(false)} onSuccess={() => {}} />
    </>
  )
}
