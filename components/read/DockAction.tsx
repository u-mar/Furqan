import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface DockActionProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode
  label: string
  active?: boolean
}

export default function DockAction({ icon, label, active, className, ...rest }: DockActionProps) {
  return (
    <button type="button" className={cn('mushaf-dock-action', active && 'is-active', className)} {...rest}>
      <span className="mushaf-dock-action__icon">{icon}</span>
      <span className="mushaf-dock-action__label">{label}</span>
    </button>
  )
}
