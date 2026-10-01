'use client'

import { useEffect, useState } from 'react'
import ContinueReadingCard from '@/components/home/ContinueReadingCard'
import DailyVerseCard from '@/components/home/DailyVerseCard'
import HomeHero from '@/components/home/HomeHero'
import HomeScreen from '@/components/home/HomeScreen'
import PrayerQiblaCard from '@/components/home/PrayerQiblaCard'
import PrayerQiblaTiles from '@/components/home/PrayerQiblaTiles'
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
    <HomeScreen className="max-w-lg mx-auto" withBottomNav>
      <HomeHero displayName={displayName === 'Guest' ? t('Guest') : displayName} />

      <div className="reveal mt-[22px]" style={{ animationDelay: '80ms' }}>
        <PrayerQiblaCard />
      </div>

      <div className="reveal mt-3" style={{ animationDelay: '120ms' }}>
        <PrayerQiblaTiles />
      </div>

      <div className="reveal mt-[22px]" style={{ animationDelay: '160ms' }}>
        <DailyVerseCard />
      </div>

      <div className="reveal mt-[22px]" style={{ animationDelay: '200ms' }}>
        <ContinueReadingCard />
      </div>
    </HomeScreen>
  )
}
