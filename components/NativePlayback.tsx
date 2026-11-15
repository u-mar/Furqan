'use client'

import { useEffect } from 'react'
import {
  getListenState,
  stopListening,
  subscribeListen,
  togglePlay,
} from '@/lib/listen-player'
import { getNatureState, natureName, stopNature, subscribeNature, toggleNature } from '@/lib/nature-sounds'
import { getReciterById } from '@/lib/reciters'
import { tr } from '@/lib/i18n-core'

interface NabaPlayback {
  show: (options: {
    title: string
    text: string
    playing: boolean
    pauseLabel: string
    playLabel: string
    stopLabel: string
    channelName: string
  }) => Promise<void>
  hide: () => Promise<void>
  addListener: (event: 'action', handler: (data: { action: 'toggle' | 'stop' }) => void) => Promise<{ remove: () => void }>
}

/** What the "Now playing" notification shows, or null when nothing of Listen's is on. */
function nowPlaying(): { title: string; text: string; playing: boolean } | null {
  const listen = getListenState()
  if (listen.surah && listen.reciterId) {
    return {
      title: listen.surah.englishName,
      text: getReciterById(listen.reciterId).name,
      playing: listen.status === 'playing' || listen.status === 'loading',
    }
  }
  const nature = getNatureState()
  if (nature.live && nature.sounds.length) {
    return { title: nature.sounds.map(natureName).join(' · '), text: tr('Nature mode'), playing: nature.playing }
  }
  return null
}

/**
 * In the Play Store app, keeps a recitation (Listen) or the nature sounds playing with the phone
 * locked, through Android's "Now playing" service (android/…/NabaPlaybackService.java). It starts
 * with the first play, follows what plays (its notification's Pause/Play and Stop come back here),
 * and ends when the listening stops. Qari and Read stop when the app is left, so they are not in it.
 * On the website it does nothing.
 */
export default function NativePlayback() {
  useEffect(() => {
    const capacitor = (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
    if (!capacitor?.isNativePlatform?.()) return
    let cancelled = false
    const cleanups: Array<() => void> = []
    void import('@capacitor/core').then(({ registerPlugin }) => {
      if (cancelled) return
      const playback = registerPlugin<NabaPlayback>('NabaPlayback')
      // Only ever started by playing something, never by a paused surah merely restored.
      let shown = ''
      let started = false
      // An app built before the service existed has no such plugin: then nothing more is asked of it.
      let missing = false
      const sync = () => {
        if (missing) return
        const now = nowPlaying()
        if (!now) {
          if (started) void playback.hide().catch(() => {})
          started = false
          shown = ''
          return
        }
        if (!started && !now.playing) return
        const options = {
          ...now,
          pauseLabel: tr('Pause'),
          playLabel: tr('Play'),
          stopLabel: tr('Stop'),
          channelName: tr('Now playing'),
        }
        const key = JSON.stringify(options)
        if (key === shown) return
        shown = key
        started = true
        void playback.show(options).catch((err: unknown) => {
          // Refused (Android does not let a service start from the background): tried again on the next change.
          started = false
          shown = ''
          if ((err as { code?: string } | null)?.code === 'UNIMPLEMENTED') missing = true
        })
      }
      void playback
        .addListener('action', ({ action }) => {
          const listening = Boolean(getListenState().surah)
          if (action === 'stop') {
            if (listening) stopListening()
            else stopNature()
            return
          }
          if (listening) togglePlay()
          else toggleNature()
        })
        .then((handle) => {
          if (cancelled) handle.remove()
          else cleanups.push(() => handle.remove())
        })
        .catch(() => {
          missing = true
        })
      cleanups.push(subscribeListen(sync), subscribeNature(sync))
      sync()
    })
    return () => {
      cancelled = true
      cleanups.forEach((cleanup) => cleanup())
    }
  }, [])

  return null
}
