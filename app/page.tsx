'use client'

import ContinueReadingCard from '@/components/home/ContinueReadingCard'
import DailyVerseCard from '@/components/home/DailyVerseCard'
import MiniPlayer from '@/components/listen/MiniPlayer'
import { FavouriteSheikhs, HomeTopBar, ListeningHero, NextPrayerCard, QuickAccess } from '@/components/home/HomeSections'
import { useRouter } from 'next/navigation'
import { useAppSettings } from '@/hooks/useAppSettings'
import { BOTTOM_NAV_HEIGHT_REM } from '@/lib/bottom-nav'

/**
 * Home: black, a few large pieces and little text — the next prayer under the
 * name, the reciter to carry on listening to, three favourite sheikhs, the
 * shortcuts with their pictures, where reading stopped, and the ayah of the week.
 */
export default function Home() {
  // Re-renders Home when the language changes.
  useAppSettings()
  const router = useRouter()

  return (
    <main
      className="min-h-[100dvh] w-full bg-[var(--app-bg)] [overscroll-behavior-x:none] [touch-action:pan-y]"
      // Room for the player too, while a surah is playing (it sets --listen-dock).
      style={{ paddingBottom: `calc(${BOTTOM_NAV_HEIGHT_REM}rem + env(safe-area-inset-bottom) + 1.5rem + var(--listen-dock, 0px))` }}
    >
      <div className="mx-auto flex w-full max-w-lg flex-col px-4 pt-[max(0.875rem,calc(env(safe-area-inset-top)+0.5rem))]">
        <div className="reveal">
          <HomeTopBar />
        </div>
        <div className="reveal mt-6" style={{ animationDelay: '40ms' }}>
          <NextPrayerCard />
        </div>
        <div className="reveal mt-8" style={{ animationDelay: '60ms' }}>
          <ListeningHero />
        </div>
        <div className="reveal mt-7" style={{ animationDelay: '80ms' }}>
          <FavouriteSheikhs />
        </div>
        <div className="reveal mt-7" style={{ animationDelay: '120ms' }}>
          <QuickAccess />
        </div>
        <div className="reveal mt-7" style={{ animationDelay: '160ms' }}>
          <ContinueReadingCard />
        </div>
        <div className="reveal mt-8" style={{ animationDelay: '200ms' }}>
          <DailyVerseCard />
        </div>
      </div>
      {/* While a surah plays (Continue listening, or one started in Listen), its
          player with its controls; tap it for Now playing. Paused, it goes. */}
      <MiniPlayer onOpen={() => router.push('/listen?player=1')} whilePlaying />
    </main>
  )
}
