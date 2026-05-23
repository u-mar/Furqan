'use client'

import { useEffect, useState } from 'react'
import { getAppSettings, type AppSettings } from '@/lib/app-settings'

export function useAppSettings(): AppSettings {
  const [settings, setSettings] = useState<AppSettings>(() =>
    typeof window !== 'undefined' ? getAppSettings() : getAppSettings()
  )

  useEffect(() => {
    setSettings(getAppSettings())
    const onChange = (e: Event) => {
      setSettings((e as CustomEvent<AppSettings>).detail)
    }
    window.addEventListener('app-settings-changed', onChange)
    return () => window.removeEventListener('app-settings-changed', onChange)
  }, [])

  return settings
}
