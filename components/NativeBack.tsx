'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { closeNewestOnBack } from '@/lib/native-back'

type BackAnswer = 'handled' | 'leave'

/**
 * The phone's back button in the Play Store app, which asks this page what to
 * do (MainActivity): an open sheet closes; any other screen goes to Home; on
 * Home the app is left, as other apps are. Never closes the app from inside it.
 */
export default function NativeBack() {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const page = window as Window & { nabaBack?: () => BackAnswer }
    page.nabaBack = () => {
      if (closeNewestOnBack()) return 'handled'
      if (pathname !== '/') {
        router.push('/')
        return 'handled'
      }
      return 'leave'
    }
    return () => {
      delete page.nabaBack
    }
  }, [pathname, router])

  return null
}
