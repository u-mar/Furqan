'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { BOTTOM_NAV_HEIGHT_REM, showBottomNavFor } from '@/lib/bottom-nav'
import { tapFeedback } from '@/lib/haptics'
import { LAST_READ_PAGE_KEY } from '@/lib/mushaf'
import { useT } from '@/lib/i18n'

/**
 * Read, Home, Qari, Listen — the four places the app is built around.
 * Fixed to the bottom of Home, Listen, every Qari screen except the
 * recorder, and both Prayer screens; the mushaf is its own deeper screen
 * and hides it to keep the whole screen for reading.
 */
export default function BottomNav() {
  const t = useT()
  const pathname = usePathname()
  const [lastPage, setLastPage] = useState(1)

  useEffect(() => {
    const page = Math.min(604, Math.max(1, Number(localStorage.getItem(LAST_READ_PAGE_KEY) || '1') || 1))
    setLastPage(page)
  }, [])

  if (!showBottomNavFor(pathname)) return null

  const tabs: { id: string; href: string; label: string; icon: string; active: boolean }[] = [
    { id: 'read', href: `/read?page=${lastPage}`, label: t('Read'), icon: 'read', active: false },
    { id: 'home', href: '/', label: t('Home'), icon: 'home', active: pathname === '/' },
    { id: 'qari', href: '/qari', label: t('Qari'), icon: 'qari', active: pathname.startsWith('/qari') },
    { id: 'listen', href: '/listen', label: t('Listen'), icon: 'listen', active: pathname === '/listen' },
  ]

  return (
    <nav
      aria-label={t('Main navigation')}
      className="bottom-nav fixed inset-x-0 bottom-0 z-50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-auto flex w-full max-w-lg items-stretch justify-between px-2" style={{ height: `${BOTTOM_NAV_HEIGHT_REM}rem` }}>
        {tabs.map((tab) => (
          <Link
            key={tab.id}
            href={tab.href}
            onClick={() => tapFeedback()}
            aria-current={tab.active ? 'page' : undefined}
            className="bottom-nav__item ed-focus"
          >
            <img
              src={`/icons/${tab.icon}.png`}
              alt=""
              draggable={false}
              className={`bottom-nav__icon ${tab.active ? 'bottom-nav__icon--active' : ''}`}
            />
            <span className={`bottom-nav__label ${tab.active ? 'bottom-nav__label--active' : ''}`}>{tab.label}</span>
            <span className={`bottom-nav__dot ${tab.active ? 'bottom-nav__dot--active' : ''}`} aria-hidden />
          </Link>
        ))}
      </div>
    </nav>
  )
}
