'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { House, Mic, UserRound } from 'lucide-react'
import AccountSheet from '@/components/settings/AccountSheet'
import { useViewer } from '@/hooks/useViewer'
import { tapFeedback } from '@/lib/haptics'
import { cn } from '@/lib/cn'
import { useT } from '@/lib/i18n'

/**
 * The bar along the bottom of every Qari screen: the feed, a pill to record,
 * and your own profile.
 *
 * Hidden while recording — that screen is a single task with its own way
 * out, and the bar would only invite you to abandon a take mid-recitation.
 */
export default function QariTabBar() {
  const t = useT()
  const pathname = usePathname()
  const viewer = useViewer()
  const [accountOpen, setAccountOpen] = useState(false)

  if (pathname === '/qari/record') return null

  const onFeed = pathname === '/qari'
  const myProfile = viewer ? `/qari/${encodeURIComponent(viewer.username)}` : null
  const onMyProfile = Boolean(myProfile && pathname === myProfile)

  return (
    <>
      <nav className="qari-tabbar" aria-label={t('Qari')}>
        <div className="qari-tabbar__inner">
          <Link
            href="/qari"
            onClick={tapFeedback}
            aria-current={onFeed ? 'page' : undefined}
            className={cn('qari-tabbar__item ed-focus', onFeed && 'is-active')}
          >
            <House className="h-[21px] w-[21px]" strokeWidth={onFeed ? 2.3 : 1.9} />
            {t('Feed')}</Link>

          <Link href="/qari/record" onClick={tapFeedback} className="qari-tabbar__add ed-focus">
            <Mic className="h-[17px] w-[17px]" strokeWidth={2.2} />
            {t('Record')}</Link>

          {viewer && myProfile ? (
            <Link
              href={myProfile}
              onClick={tapFeedback}
              aria-current={onMyProfile ? 'page' : undefined}
              aria-label={t('Your profile')}
              className={cn('qari-tabbar__item ed-focus', onMyProfile && 'is-active')}
            >
              <UserRound className="h-[21px] w-[21px]" strokeWidth={onMyProfile ? 2.3 : 1.9} />
              {t('You')}</Link>
          ) : (
            <button
              type="button"
              onClick={() => {
                tapFeedback()
                setAccountOpen(true)
              }}
              aria-label={t('Sign in')}
              className="qari-tabbar__item ed-focus"
            >
              <UserRound className="h-[21px] w-[21px]" strokeWidth={1.9} />
              {t('You')}</button>
          )}
        </div>
      </nav>

      <AccountSheet open={accountOpen} onClose={() => setAccountOpen(false)} onSuccess={() => {}} />
    </>
  )
}
