'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { getReciterById } from '@/lib/reciters'
import { getPlayableAyahAudioUrl, revokePlayableAyahAudioUrl } from '@/lib/offline-audio'
import type { Verse } from '@/types'

export interface PageRecitationState {
  playing: boolean
  loading: boolean
  highlightedVerseKey: string | null
  error: string | null
}

const idleState: PageRecitationState = {
  playing: false,
  loading: false,
  highlightedVerseKey: null,
  error: null,
}

const PRELOAD_AHEAD = 2

interface UsePageRecitationOptions {
  reciterId: string
  verses: Verse[]
}

interface PreloadedClip {
  verseKey: string
  url: string
  audio: HTMLAudioElement
}

function parseVerseKey(verseKey: string): { surah: number; ayah: number } | null {
  const parts = verseKey.split(':')
  const surah = Number(parts[0])
  const ayah = Number(parts[1])
  if (!surah || !ayah) return null
  return { surah, ayah }
}

function waitForAudioReady(audio: HTMLAudioElement): Promise<void> {
  if (audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
    return Promise.resolve()
  }
  return new Promise((resolve, reject) => {
    const onReady = () => {
      cleanup()
      resolve()
    }
    const onFail = () => {
      cleanup()
      reject(new Error('Audio preload failed'))
    }
    const cleanup = () => {
      audio.removeEventListener('canplaythrough', onReady)
      audio.removeEventListener('error', onFail)
    }
    audio.addEventListener('canplaythrough', onReady, { once: true })
    audio.addEventListener('error', onFail, { once: true })
    audio.load()
  })
}

export function usePageRecitation({ reciterId, verses }: UsePageRecitationOptions) {
  const [state, setState] = useState<PageRecitationState>(idleState)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const sessionRef = useRef(0)
  const playbackSessionRef = useRef(0)
  const indexRef = useRef(0)
  const versesRef = useRef(verses)
  const reciterRef = useRef(reciterId)
  const playModeRef = useRef<'page' | 'single'>('page')
  const abortingRef = useRef(false)
  const objectUrlRef = useRef<string | null>(null)
  const preloadMapRef = useRef<Map<string, PreloadedClip>>(new Map())
  const preloadBlobUrlsRef = useRef<Map<string, string>>(new Map())
  const preloadingKeysRef = useRef<Set<string>>(new Set())

  versesRef.current = verses
  reciterRef.current = reciterId

  const clearPreload = useCallback(() => {
    for (const pre of preloadMapRef.current.values()) {
      pre.audio.pause()
      pre.audio.src = ''
    }
    preloadMapRef.current.clear()
    for (const url of preloadBlobUrlsRef.current.values()) {
      revokePlayableAyahAudioUrl(url)
    }
    preloadBlobUrlsRef.current.clear()
    preloadingKeysRef.current.clear()
  }, [])

  const clearMainObjectUrl = useCallback(() => {
    if (objectUrlRef.current) {
      revokePlayableAyahAudioUrl(objectUrlRef.current)
      objectUrlRef.current = null
    }
  }, [])

  const takePreloaded = useCallback((verseKey: string): PreloadedClip | null => {
    const pre = preloadMapRef.current.get(verseKey)
    if (!pre || pre.audio.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) return null
    preloadMapRef.current.delete(verseKey)
    pre.audio.pause()
    pre.audio.src = ''
    return pre
  }, [])

  const preloadAtIndex = useCallback(async (index: number, session: number) => {
    const list = versesRef.current
    if (index >= list.length || session !== sessionRef.current) return

    const verse = list[index]
    const verseKey = verse.verse_key
    if (preloadMapRef.current.has(verseKey) || preloadingKeysRef.current.has(verseKey)) return

    const parsed = parseVerseKey(verseKey)
    if (!parsed) return

    preloadingKeysRef.current.add(verseKey)
    try {
      const folder = getReciterById(reciterRef.current).folder
      const url = await getPlayableAyahAudioUrl(folder, parsed.surah, parsed.ayah)
      if (!url || session !== sessionRef.current) return

      const preAudio = new Audio()
      preAudio.preload = 'auto'
      preAudio.src = url
      await waitForAudioReady(preAudio)
      if (session !== sessionRef.current) {
        preAudio.pause()
        preAudio.src = ''
        if (url.startsWith('blob:')) revokePlayableAyahAudioUrl(url)
        return
      }

      preloadMapRef.current.set(verseKey, { verseKey, url, audio: preAudio })
      if (url.startsWith('blob:')) preloadBlobUrlsRef.current.set(verseKey, url)
    } catch {
      /* next ayah will load on demand */
    } finally {
      preloadingKeysRef.current.delete(verseKey)
    }
  }, [])

  const preloadAheadFromIndex = useCallback(
    (index: number, session: number) => {
      for (let offset = 1; offset <= PRELOAD_AHEAD; offset++) {
        void preloadAtIndex(index + offset, session)
      }
    },
    [preloadAtIndex]
  )

  const stop = useCallback(() => {
    sessionRef.current += 1
    abortingRef.current = true
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      clearMainObjectUrl()
      audio.removeAttribute('src')
      audio.load()
    }
    clearPreload()
    abortingRef.current = false
    indexRef.current = 0
    playModeRef.current = 'page'
    playbackSessionRef.current = 0
    setState(idleState)
  }, [clearMainObjectUrl, clearPreload])

  const finishPlayback = useCallback(() => {
    sessionRef.current += 1
    abortingRef.current = true
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      clearMainObjectUrl()
      audio.removeAttribute('src')
      audio.load()
    }
    clearPreload()
    abortingRef.current = false
    indexRef.current = 0
    playModeRef.current = 'page'
    playbackSessionRef.current = 0
    setState(idleState)
  }, [clearMainObjectUrl, clearPreload])

  const playIndex = useCallback(
    async (index: number, session: number, options?: { seamless?: boolean }) => {
      const audio = audioRef.current
      const list = versesRef.current
      if (!audio || session !== sessionRef.current) return

      if (index >= list.length) {
        finishPlayback()
        return
      }

      const verse = list[index]
      const parsed = parseVerseKey(verse.verse_key)
      if (!parsed) return

      indexRef.current = index
      playbackSessionRef.current = session

      const pre = options?.seamless ? takePreloaded(verse.verse_key) : null
      const usePreload = Boolean(pre)

      setState((s) => ({
        ...s,
        playing: true,
        loading: !usePreload,
        highlightedVerseKey: verse.verse_key,
        error: null,
      }))

      let url: string | null = null
      if (usePreload && pre) {
        url = pre.url
      } else {
        const folder = getReciterById(reciterRef.current).folder
        url = await getPlayableAyahAudioUrl(folder, parsed.surah, parsed.ayah)
      }

      if (!url) {
        setState((s) => ({
          ...s,
          playing: false,
          loading: false,
          error: 'Audio unavailable offline. Download this surah in Listen first.',
        }))
        return
      }

      try {
        clearMainObjectUrl()
        const blobFromPreload = preloadBlobUrlsRef.current.get(verse.verse_key)
        if (blobFromPreload) {
          preloadBlobUrlsRef.current.delete(verse.verse_key)
          objectUrlRef.current = blobFromPreload
        } else if (url.startsWith('blob:')) {
          objectUrlRef.current = url
        }
        audio.src = url
        await audio.play()
        if (session !== sessionRef.current) return
        setState((s) => ({ ...s, loading: false }))
        if (playModeRef.current === 'page') {
          preloadAheadFromIndex(index, session)
        }
      } catch {
        if (session !== sessionRef.current) return
        setState((s) => ({
          ...s,
          loading: false,
          playing: false,
          highlightedVerseKey: null,
          error: `Could not play ayah ${parsed.ayah}`,
        }))
      }
    },
    [clearMainObjectUrl, finishPlayback, preloadAheadFromIndex, takePreloaded]
  )

  const start = useCallback(() => {
    sessionRef.current += 1
    clearPreload()
    playModeRef.current = 'page'
    indexRef.current = 0
    void playIndex(0, sessionRef.current)
  }, [clearPreload, playIndex])

  const playVerse = useCallback(
    (verseKey: string, options?: { continueOnPage?: boolean }) => {
      const index = versesRef.current.findIndex((v) => v.verse_key === verseKey)
      if (index < 0) return
      sessionRef.current += 1
      clearPreload()
      playModeRef.current = options?.continueOnPage === false ? 'single' : 'page'
      indexRef.current = index
      void playIndex(index, sessionRef.current)
    },
    [clearPreload, playIndex]
  )

  useEffect(() => {
    const audio = new Audio()
    audioRef.current = audio

    const onEnded = () => {
      if (abortingRef.current) return
      const session = playbackSessionRef.current
      if (session !== sessionRef.current) return

      if (playModeRef.current === 'single') {
        finishPlayback()
        return
      }
      void playIndex(indexRef.current + 1, session, { seamless: true })
    }

    const onTimeUpdate = () => {
      if (abortingRef.current || playModeRef.current !== 'page') return
      const session = playbackSessionRef.current
      if (session !== sessionRef.current) return
      const duration = audio.duration
      if (!Number.isFinite(duration) || duration <= 0) return
      if (audio.currentTime < duration * 0.45) return
      preloadAheadFromIndex(indexRef.current, session)
    }

    const onError = () => {
      if (abortingRef.current) return
      const session = playbackSessionRef.current
      if (session !== sessionRef.current) return

      if (playModeRef.current === 'single') {
        finishPlayback()
        return
      }
      const next = indexRef.current + 1
      if (next < versesRef.current.length) {
        void playIndex(next, session, { seamless: true })
      } else {
        finishPlayback()
      }
    }

    audio.addEventListener('ended', onEnded)
    audio.addEventListener('error', onError)
    audio.addEventListener('timeupdate', onTimeUpdate)

    return () => {
      abortingRef.current = true
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('error', onError)
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.pause()
      clearMainObjectUrl()
      clearPreload()
      audio.removeAttribute('src')
      audio.load()
      abortingRef.current = false
    }
  }, [clearMainObjectUrl, clearPreload, finishPlayback, playIndex, preloadAheadFromIndex])

  useEffect(() => {
    if (!state.playing && !state.loading) return
    sessionRef.current += 1
    abortingRef.current = true
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
    }
    clearPreload()
    abortingRef.current = false
    indexRef.current = 0
    playModeRef.current = 'page'
    playbackSessionRef.current = 0
    setState(idleState)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verses.map((v) => v.verse_key).join(',')])

  useEffect(() => {
    if (!state.playing && !state.loading) return
    sessionRef.current += 1
    clearPreload()
    void playIndex(indexRef.current, sessionRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reciterId])

  const isActive = state.playing || state.loading

  return { state, stop, start, playVerse, isActive }
}
