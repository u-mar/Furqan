'use client'

import type { DiffStatus } from '@/types'
import { cn } from '@/lib/cn'

interface DiffWordProps {
  text: string
  status: DiffStatus
  title?: string
}

const statusClass: Record<DiffStatus, string> = {
  correct: 'bg-emerald-50 text-emerald-700',
  wrong: 'bg-red-50 text-red-700',
  missed: 'bg-amber-50 text-amber-700',
  extra: 'bg-stone-100 text-stone-500 line-through',
}

export default function DiffWord({ text, status, title }: DiffWordProps) {
  if (!text && status !== 'missed') return null

  return (
    <span
      dir="rtl"
      lang="ar"
      title={title}
      className={cn(
        'inline mx-0.5 px-1 py-0.5 rounded arabic-text text-[clamp(18px,4.5vw,26px)] leading-relaxed',
        statusClass[status]
      )}
    >
      {text || '·'}
    </span>
  )
}
