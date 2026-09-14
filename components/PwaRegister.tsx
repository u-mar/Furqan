'use client'

import { useEffect } from 'react'

const APP_BUILD_VERSION = '2026-05-28-qcf-hotfix-1'

export default function PwaRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    // In development the file names under /_next/static never change, so the
    // worker's cache-first rule would keep serving yesterday's styles and code
    // — a phone testing against the dev server would never see an edit. Offline
    // support only matters in production builds, where those names are hashed.
    if (process.env.NODE_ENV !== 'production') {
      void navigator.serviceWorker
        .getRegistrations()
        .then((regs) => Promise.all(regs.map((reg) => reg.unregister())))
        .then(() => caches.keys())
        .then((keys) => Promise.all(keys.filter((key) => key.includes('static')).map((key) => caches.delete(key))))
        .catch(() => {})
      return
    }

    let reloaded = false

    const reloadOnce = () => {
      if (reloaded) return
      reloaded = true
      window.location.reload()
    }

    const hardRefreshPwaCaches = async () => {
      try {
        const seen = localStorage.getItem('muyassar_build_version')
        if (seen === APP_BUILD_VERSION) return
        localStorage.setItem('muyassar_build_version', APP_BUILD_VERSION)

        const regs = await navigator.serviceWorker.getRegistrations()
        await Promise.all(regs.map((reg) => reg.unregister()))
        const keys = await caches.keys()
        await Promise.all(keys.map((key) => caches.delete(key)))
        reloadOnce()
      } catch {
        // keep normal registration flow if reset fails
      }
    }

    void hardRefreshPwaCaches()

    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        registration.update().catch(() => {})

        registration.addEventListener('updatefound', () => {
          const worker = registration.installing
          if (!worker) return
          worker.addEventListener('statechange', () => {
            if (worker.state === 'activated' && navigator.serviceWorker.controller) {
              reloadOnce()
            }
          })
        })

        let refreshing = false
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (refreshing) return
          refreshing = true
          reloadOnce()
        })
      })
      .catch((err) => {
        console.warn('Service worker registration failed:', err)
      })

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        navigator.serviceWorker.getRegistration().then((reg) => reg?.update().catch(() => {}))
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  return null
}
