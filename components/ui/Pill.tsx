'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

const variants = {
  accent: 'bg-teal-50 text-teal-700 dark:bg-teal-400/10 dark:text-teal-300',
  success: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300',
  danger: 'bg-red-50 text-red-700 dark:bg-red-400/10 dark:text-red-300',
  warning: 'bg-amber-50 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300',
}

export interface PillProps {
  variant?: keyof typeof variants
  children: ReactNode
  className?: string
}

export default function Pill({ variant = 'accent', children, className }: PillProps) {
  return (
    <span
      className={cn(
        'text-[11px] font-medium px-2 py-0.5 rounded-full',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  )
}
