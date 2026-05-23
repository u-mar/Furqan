import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface AppShellProps {
  children: ReactNode
  className?: string
}

/** Full viewport shell — edge-to-edge on laptop, same on mobile. */
export default function AppShell({ children, className }: AppShellProps) {
  return (
    <div className={cn('min-h-[100dvh] w-full bg-[#0a0a0a] text-white', className)}>
      {children}
    </div>
  )
}
