'use client'

import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'
import { bootstrapOfflineReader } from '@/lib/offline-bootstrap'
import { APP_NAME } from '@/lib/app-brand'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_SESSION_KEY = 'pwa_install_dismissed_session'

function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

function isAndroidDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  return /android/i.test(navigator.userAgent)
}

function isStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [visible, setVisible] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)
  const [isIos, setIsIos] = useState(false)
  const [isAndroid, setIsAndroid] = useState(false)

  useEffect(() => {
    if (isStandaloneMode()) {
      setIsStandalone(true)
      return
    }

    setIsIos(isIosDevice())
    setIsAndroid(isAndroidDevice())

    try {
      localStorage.removeItem('pwa_install_dismissed')
    } catch {
      /* ignore legacy permanent dismiss */
    }

    if (sessionStorage.getItem(DISMISS_SESSION_KEY) === '1') {
      setDismissed(true)
      return
    }

    const showTimer = window.setTimeout(() => setVisible(true), 1200)

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
      setVisible(true)
    }

    window.addEventListener('beforeinstallprompt', handler)

    const onInstalled = () => {
      setIsStandalone(true)
      setVisible(false)
      void bootstrapOfflineReader()
    }
    window.addEventListener('appinstalled', onInstalled)

    return () => {
      window.clearTimeout(showTimer)
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  function dismiss() {
    sessionStorage.setItem(DISMISS_SESSION_KEY, '1')
    setDismissed(true)
    setVisible(false)
  }

  if (isStandalone || dismissed || !visible) return null

  const canNativeInstall = Boolean(deferred)

  async function install() {
    if (!deferred) return
    await deferred.prompt()
    const { outcome } = await deferred.userChoice
    if (outcome === 'accepted') {
      setDeferred(null)
      setVisible(false)
      void bootstrapOfflineReader()
    }
  }

  const title = isIos
    ? 'Install on iPhone'
    : isAndroid && !canNativeInstall
      ? 'Install on Android'
      : `Install ${APP_NAME}`

  const body = canNativeInstall ? (
    <p className="mt-1 text-xs leading-relaxed text-stone-400">
      Add to your home screen for a full-screen app. Offline Quran data downloads after install.
    </p>
  ) : isIos ? (
    <p className="mt-1 text-xs leading-relaxed text-stone-400">
      Tap <strong className="text-white">Share</strong> in Safari, then{' '}
      <strong className="text-white">Add to Home Screen</strong>. Open the app once on Wi‑Fi to save
      offline data.
    </p>
  ) : isAndroid ? (
    <p className="mt-1 text-xs leading-relaxed text-stone-400">
      Tap the browser menu <strong className="text-white">⋮</strong>, then{' '}
      <strong className="text-white">Install app</strong> or{' '}
      <strong className="text-white">Add to Home screen</strong>.
    </p>
  ) : (
    <p className="mt-1 text-xs leading-relaxed text-stone-400">
      In Chrome or Edge, open the browser menu and choose{' '}
      <strong className="text-white">Install {APP_NAME}</strong>, or use the install icon in the
      address bar.
    </p>
  )

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2"
      role="dialog"
      aria-labelledby="install-prompt-title"
      aria-describedby="install-prompt-desc"
    >
      <div className="relative mx-auto w-full max-w-lg rounded-2xl border border-white/10 bg-[#1c1c1e] p-4 shadow-2xl">
        <button
          type="button"
          onClick={dismiss}
          className="absolute right-5 top-5 rounded-full p-1 text-stone-500 hover:bg-white/10"
          aria-label="Dismiss install prompt"
        >
          <X className="h-4 w-4" />
        </button>
        <p id="install-prompt-title" className="pr-8 text-sm font-semibold text-white">
          {title}
        </p>
        <div id="install-prompt-desc">{body}</div>
        {canNativeInstall ? (
          <button
            type="button"
            onClick={() => void install()}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-500"
          >
            <Download className="h-4 w-4" />
            Install app
          </button>
        ) : (
          <button
            type="button"
            onClick={dismiss}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/15"
          >
            Got it
          </button>
        )}
      </div>
    </div>
  )
}
