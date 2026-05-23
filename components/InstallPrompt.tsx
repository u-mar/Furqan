'use client'

import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)
  const [isIos, setIsIos] = useState(false)

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsStandalone(true)
      return
    }

    setIsIos(isIosDevice())

    const dismissedBefore = localStorage.getItem('pwa_install_dismissed')
    if (dismissedBefore) setDismissed(true)

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  function dismiss() {
    localStorage.setItem('pwa_install_dismissed', '1')
    setDismissed(true)
    setDeferred(null)
  }

  if (isStandalone || dismissed) return null

  if (isIos && !deferred) {
    return (
      <div className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-2xl border border-white/10 bg-[#1c1c1e] p-4 shadow-2xl lg:hidden">
        <button
          type="button"
          onClick={dismiss}
          className="absolute right-3 top-3 rounded-full p-1 text-stone-500 hover:bg-white/10"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
        <p className="pr-8 text-sm font-semibold text-white">Install on iPhone</p>
        <p className="mt-1 text-xs leading-relaxed text-stone-400">
          Tap <strong className="text-white">Share</strong> in Safari, then{' '}
          <strong className="text-white">Add to Home Screen</strong>.
        </p>
      </div>
    )
  }

  if (!deferred) return null

  const prompt = deferred

  async function install() {
    await prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') setDeferred(null)
  }

  return (
    <div className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-2xl border border-white/10 bg-[#1c1c1e] p-4 shadow-2xl lg:hidden">
      <button
        type="button"
        onClick={dismiss}
        className="absolute right-3 top-3 rounded-full p-1 text-stone-500 hover:bg-white/10"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
      <p className="pr-8 text-sm font-semibold text-white">Install Al Quran</p>
      <p className="mt-1 text-xs text-stone-400">
        Add to your home screen for a full-screen app experience on your phone.
      </p>
      <button
        type="button"
        onClick={install}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white"
      >
        <Download className="h-4 w-4" />
        Install app
      </button>
    </div>
  )
}
