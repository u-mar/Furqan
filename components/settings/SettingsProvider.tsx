'use client'

import { useEffect, useLayoutEffect, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import {
  applyThemeToDocument,
  getAppSettings,
  type AppSettings,
} from '@/lib/app-settings'
import { applyLanguageToDocument } from '@/lib/i18n'

/*
 * Renders its children as they are from the very first render. It used to
 * wrap them in a <div> until this effect had run and then drop the wrapper;
 * that change of shape made React unmount and remount the whole app once on
 * every load, so every screen's requests went out twice. The theme is already
 * on the page before it draws (the script in the layout's <head>), and the
 * body paints its background, so the wrapper added nothing.
 */
export default function SettingsProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()

  // Black everywhere but the mushaf, which keeps its own page colours: set on
  // every change of screen, before it paints.
  useLayoutEffect(() => {
    applyThemeToDocument(getAppSettings().theme, pathname)
  }, [pathname])

  useEffect(() => {
    const settings = getAppSettings()
    applyLanguageToDocument(settings.language)

    // The saved Quran is not read into memory here (a parse that froze the app for seconds a moment
    // after launch, wherever it was): Read does it itself, the first time it is opened offline.

    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<AppSettings>).detail
      applyThemeToDocument(detail.theme)
      applyLanguageToDocument(detail.language)
    }

    window.addEventListener('app-settings-changed', onChange)

    return () => {
      window.removeEventListener('app-settings-changed', onChange)
    }
  }, [])

  return <>{children}</>
}
