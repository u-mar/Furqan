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
        'home-screen relative min-h-[100dvh] w-full bg-white text-[var(--app-text)]',
        'dark:bg-[var(--app-bg)]',
        'pb-[max(1.5rem,env(safe-area-inset-bottom))]',
        className
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 hidden bg-[var(--home-glow)] dark:block"
        aria-hidden
      />
      <div className="relative z-10 mx-auto w-full px-4 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-6 lg:px-10 lg:pt-8 xl:px-14 xl:pt-10">
        {children}
      </div>
    </main>
  )
}
