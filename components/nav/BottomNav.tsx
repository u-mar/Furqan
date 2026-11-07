'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { BookOpen, Headphones, House, Mic, type LucideIcon } from 'lucide-react'
import { BOTTOM_NAV_PILL_REM, showBottomNavFor } from '@/lib/bottom-nav'
import { tapFeedback } from '@/lib/haptics'
import { LAST_READ_PAGE_KEY } from '@/lib/mushaf'
import { notePath } from '@/lib/nav-trail'
import { useT } from '@/lib/i18n'

/**
 * Read, Home, Qari, Listen — the four places the app is built around, on a
 * rounded bar floating over the bottom of the screen: white line icons with
 * their names, the tab you are on bright white with a small dot under it. Fixed to the bottom of Home, Listen, every Qari screen except the
 * recorder, both Prayer screens, and Halaqa; the mushaf is its own deeper
 * screen and hides it to keep the whole screen for reading.
 */
export default function BottomNav() {
  const t = useT()
  const pathname = usePathname()
  const [lastPage, setLastPage] = useState(1)

  // Looked up again on every screen change: the bar outlives Read, and Read
  // must open where it was last left, not where it was when the app opened.
  useEffect(() => {
    notePath(pathname)
    const page = Math.min(604, Math.max(1, Number(localStorage.getItem(LAST_READ_PAGE_KEY) || '1') || 1))
    setLastPage(page)
  }, [pathname])

  if (!showBottomNavFor(pathname)) return null

  const tabs: { id: string; href: string; label: string; icon: LucideIcon; active: boolean }[] = [
    { id: 'read', href: `/read?page=${lastPage}`, label: t('Read'), icon: BookOpen, active: false },
    { id: 'home', href: '/', label: t('Home'), icon: House, active: pathname === '/' },
    { id: 'qari', href: '/qari', label: t('Qari'), icon: Mic, active: pathname.startsWith('/qari') },
    { id: 'listen', href: '/listen', label: t('Listen'), icon: Headphones, active: pathname === '/listen' },
  ]

  return (
    <nav
      aria-label={t('Main navigation')}
      className="bottom-nav-dock pointer-events-none fixed inset-x-0 bottom-0 z-50 px-3"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.75rem)' }}
    >
      <div
        className="bottom-nav pointer-events-auto mx-auto flex w-full max-w-lg items-stretch justify-between rounded-full p-1.5"
        style={{ height: `${BOTTOM_NAV_PILL_REM}rem` }}
      >
        {tabs.map((tab) => (
          <Link
            key={tab.id}
            href={tab.href}
            onClick={() => tapFeedback()}
            aria-current={tab.active ? 'page' : undefined}
            className="bottom-nav__item ed-focus"
          >
            <tab.icon className="bottom-nav__icon" strokeWidth={tab.active ? 2.2 : 1.8} aria-hidden />
            <span className="bottom-nav__label">{tab.label}</span>
            <span className="bottom-nav__dot" aria-hidden />
          </Link>
        ))}
      </div>
    </nav>
  )
}
