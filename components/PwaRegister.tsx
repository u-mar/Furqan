'use client'

import { useEffect } from 'react'

const APP_BUILD_VERSION = '2026-05-28-qcf-hotfix-1'

export default function PwaRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

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
