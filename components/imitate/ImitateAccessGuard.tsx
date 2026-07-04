'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { isImitateUnlocked } from '@/lib/imitate-access'
import ImitatePinDialog from '@/components/imitate/ImitatePinDialog'

interface ImitateAccessGuardProps {
  children: ReactNode
}

export default function ImitateAccessGuard({ children }: ImitateAccessGuardProps) {
  const [unlocked, setUnlocked] = useState(false)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    const sync = () => {
      setUnlocked(isImitateUnlocked())
      setChecked(true)
    }
    sync()
    window.addEventListener('imitate-access-changed', sync)
    return () => window.removeEventListener('imitate-access-changed', sync)
  }, [])

  if (!checked) return null

  if (!unlocked) {
    return <ImitatePinDialog open onUnlocked={() => setUnlocked(true)} />
  }

  return <>{children}</>
}
