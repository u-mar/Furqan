import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface HomeScreenProps {
  children: ReactNode
  className?: string
}

export default function HomeScreen({ children, className }: HomeScreenProps) {
  return (
    <main
      className={cn(
        'home-screen relative min-h-[100dvh] w-full overflow-x-hidden bg-[var(--app-bg)] text-[var(--app-text)]',
        'pb-[max(2rem,env(safe-area-inset-bottom))]',
        '[touch-action:pan-y] [overscroll-behavior-x:none]',
        className
      )}
    >
      {/* A whisper of the accent at the very top of the page — no motion. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[40vh] bg-[var(--home-glow)]"
        aria-hidden
      />
      <div className="relative z-10 mx-auto w-full px-5 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-6 lg:px-10 lg:pt-8 xl:px-14 xl:pt-10">
        {children}
      </div>
    </main>
  )
}
