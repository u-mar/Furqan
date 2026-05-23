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
        'relative min-h-[100dvh] w-full bg-[#0a0a0a] text-white',
        'pb-[max(1.5rem,env(safe-area-inset-bottom))]',
        className
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_45%_at_50%_-15%,rgba(45,212,191,0.1),transparent)] lg:bg-[radial-gradient(ellipse_90%_55%_at_30%_-10%,rgba(45,212,191,0.08),transparent),radial-gradient(ellipse_60%_40%_at_90%_20%,rgba(245,158,11,0.05),transparent)]"
        aria-hidden
      />
      <div className="relative mx-auto w-full px-4 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-6 lg:px-10 lg:pt-8 xl:px-14 xl:pt-10">
        {children}
      </div>
    </main>
  )
}
