'use client'

import { useEffect, useState } from 'react'
import ContinueReadingCard from '@/components/home/ContinueReadingCard'
import DailyVerseCard from '@/components/home/DailyVerseCard'
import HomeSkyScreen from '@/components/home/HomeSkyScreen'
import PrayerQiblaTiles from '@/components/home/PrayerQiblaTiles'
import ReadingRemindersCard from '@/components/home/ReadingRemindersCard'
import { useAppSettings } from '@/hooks/useAppSettings'
import { getSignedInUser } from '@/lib/auth'
import { useT } from '@/lib/i18n'

export default function Home() {
  const t = useT()
  useAppSettings()
  const [displayName, setDisplayName] = useState('Guest')

  useEffect(() => {
    const syncName = () => setDisplayName(getSignedInUser()?.name ?? 'Guest')
    syncName()
    window.addEventListener('auth-user-changed', syncName)
    return () => window.removeEventListener('auth-user-changed', syncName)
  }, [])

  return (
    <HomeSkyScreen displayName={displayName === 'Guest' ? t('Guest') : displayName}>
      {/* Room above and below, so the shortcuts read as their own row (their cards do that in light) */}
      <div className="home-tiles-row reveal my-2.5" style={{ animationDelay: '80ms' }}>
        <PrayerQiblaTiles />
      </div>

      {/* The last block the first screen must show; the verse may be a short scroll below. */}
      <div className="reveal" style={{ animationDelay: '120ms' }} data-fit-end>
        <ContinueReadingCard />
        <ReadingRemindersCard />
      </div>

      <div className="reveal" style={{ animationDelay: '160ms' }}>
        <DailyVerseCard />
      </div>
    </HomeSkyScreen>
  )
}
