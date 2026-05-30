'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { getReciterById } from '@/lib/reciters'
import {
  getPlayableAyahAudioUrl,
  OFFLINE_AUDIO_HINT,
  revokePlayableAyahAudioUrl,
} from '@/lib/offline-audio'

export interface SurahPlayerState {
  surahId: number | null
  surahName: string
  versesCount: number
  currentAyah: number
  currentTime: number
  duration: number
  playing: boolean
  loading: boolean
  error: string | null
}

const initialState: SurahPlayerState = {
  surahId: null,
  surahName: '',
  versesCount: 0,
  currentAyah: 0,
  currentTime: 0,
  duration: 0,
  playing: false,
  loading: false,
  error: null,
}

const PRELOAD_AHEAD = 2

interface PreloadedAyah {
  surahId: number
  ayah: number
  url: string
  audio: HTMLAudioElement
}

function ayahKey(surahId: number, ayah: number): string {
  return `${surahId}:${ayah}`
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

export function useSurahPlayer(reciterId: string) {
  const [state, setState] = useState<SurahPlayerState>(initialState)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const sessionRef = useRef(0)
  const reciterRef = useRef(reciterId)
  const objectUrlRef = useRef<string | null>(null)
  const preloadMapRef = useRef<Map<string, PreloadedAyah>>(new Map())
  const preloadBlobUrlsRef = useRef<Map<string, string>>(new Map())
  const preloadingKeysRef = useRef<Set<string>>(new Set())

  const reciterFolder = getReciterById(reciterId).folder

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

  const takePreloaded = useCallback((surahId: number, ayah: number): PreloadedAyah | null => {
    const key = ayahKey(surahId, ayah)
    const pre = preloadMapRef.current.get(key)
    if (!pre || pre.audio.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) return null
    preloadMapRef.current.delete(key)
    pre.audio.pause()
    pre.audio.src = ''
    return pre
  }, [])

  const preloadAyah = useCallback(
    async (surahId: number, ayah: number, versesCount: number, session: number) => {
      if (ayah > versesCount || session !== sessionRef.current) return

      const key = ayahKey(surahId, ayah)
      if (preloadMapRef.current.has(key) || preloadingKeysRef.current.has(key)) return

      preloadingKeysRef.current.add(key)
      try {
        const url = await getPlayableAyahAudioUrl(reciterFolder, surahId, ayah)
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

        preloadMapRef.current.set(key, { surahId, ayah, url, audio: preAudio })
        if (url.startsWith('blob:')) preloadBlobUrlsRef.current.set(key, url)
      } catch {
        /* skip failed ayah; playback will retry on demand */
      } finally {
        preloadingKeysRef.current.delete(key)
      }
    },
    [reciterFolder]
  )

  const preloadAhead = useCallback(
    (surahId: number, currentAyah: number, versesCount: number, session: number) => {
      for (let offset = 1; offset <= PRELOAD_AHEAD; offset++) {
        void preloadAyah(surahId, currentAyah + offset, versesCount, session)
      }
    },
    [preloadAyah]
  )

  const stop = useCallback(() => {
    sessionRef.current += 1
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      clearMainObjectUrl()
      audio.src = ''
    }
    clearPreload()
    setState(initialState)
  }, [clearMainObjectUrl, clearPreload])

  const playAyah = useCallback(
    async (
      surahId: number,
      ayah: number,
      versesCount: number,
      surahName: string,
      session: number,
      options?: { seamless?: boolean }
    ) => {
      const audio = audioRef.current
      if (!audio || session !== sessionRef.current) return

      if (ayah > versesCount) {
        setState((s) => ({ ...s, playing: false, loading: false, currentAyah: versesCount }))
        return
      }

      const pre = options?.seamless ? takePreloaded(surahId, ayah) : null
      const usePreload = Boolean(pre)

      setState((s) => ({
        ...s,
        surahId,
        surahName,
        versesCount,
        currentAyah: ayah,
        currentTime: 0,
        duration: 0,
        playing: true,
        loading: !usePreload,
        error: null,
      }))

      let url: string | null = null
      if (usePreload && pre) {
        url = pre.url
      } else {
        url = await getPlayableAyahAudioUrl(reciterFolder, surahId, ayah)
      }

      if (!url) {
        if (session !== sessionRef.current) return
        setState((s) => ({
          ...s,
          loading: false,
          playing: false,
          error: OFFLINE_AUDIO_HINT,
        }))
        return
      }

      try {
        clearMainObjectUrl()
        const key = ayahKey(surahId, ayah)
        const blobFromPreload = preloadBlobUrlsRef.current.get(key)
        if (blobFromPreload) {
          preloadBlobUrlsRef.current.delete(key)
          objectUrlRef.current = blobFromPreload
        } else if (url.startsWith('blob:')) {
          objectUrlRef.current = url
        }
        audio.src = url
        await audio.play()
        if (session !== sessionRef.current) return
        setState((s) => ({ ...s, loading: false }))
        preloadAhead(surahId, ayah, versesCount, session)
      } catch {
        if (session !== sessionRef.current) return
        setState((s) => ({
          ...s,
          loading: false,
          playing: false,
          error: `Could not play ayah ${ayah}`,
        }))
      }
    },
    [clearMainObjectUrl, preloadAhead, reciterFolder, takePreloaded]
  )

  const playSurah = useCallback(
    (surahId: number, surahName: string, versesCount: number) => {
      sessionRef.current += 1
      clearPreload()
      const session = sessionRef.current
      void playAyah(surahId, 1, versesCount, surahName, session)
    },
    [clearPreload, playAyah]
  )

  const seekRelative = useCallback((seconds: number) => {
    const audio = audioRef.current
    if (!audio || !state.surahId || !audio.src) return

    const duration = Number.isFinite(audio.duration) ? audio.duration : audio.currentTime + Math.abs(seconds)
    const next = Math.max(0, Math.min(duration, audio.currentTime + seconds))
    audio.currentTime = next
  }, [state.surahId])

  const seekTo = useCallback((seconds: number) => {
    const audio = audioRef.current
    if (!audio || !state.surahId || !audio.src) return
    const duration = Number.isFinite(audio.duration) ? audio.duration : state.duration
    if (!duration) return
    const next = Math.max(0, Math.min(duration, seconds))
    audio.currentTime = next
    setState((s) => ({ ...s, currentTime: next, duration }))
  }, [state.duration, state.surahId])

  const togglePlayPause = useCallback(() => {
    const audio = audioRef.current
    if (!audio || !state.surahId) return

    if (state.playing && !state.loading) {
      audio.pause()
      setState((s) => ({ ...s, playing: false }))
      return
    }

    if (state.currentAyah > 0) {
      audio
        .play()
        .then(() => setState((s) => ({ ...s, playing: true, error: null })))
        .catch(() => setState((s) => ({ ...s, error: 'Playback failed' })))
    }
  }, [state.currentAyah, state.loading, state.playing, state.surahId])

  useEffect(() => {
    const audio = new Audio()
    audioRef.current = audio

    const onEnded = () => {
      const session = sessionRef.current
      setState((s) => {
        if (!s.surahId || s.currentAyah >= s.versesCount) {
          return { ...s, playing: false, loading: false }
        }
        const nextAyah = s.currentAyah + 1
        void playAyah(s.surahId, nextAyah, s.versesCount, s.surahName, session, { seamless: true })
        return s
      })
    }

    const onLoadedMetadata = () => {
      setState((s) => ({
        ...s,
        duration: Number.isFinite(audio.duration) ? audio.duration : 0,
      }))
    }

    const onTimeUpdate = () => {
      setState((s) => {
        const duration = Number.isFinite(audio.duration) ? audio.duration : s.duration
        if (
          s.surahId &&
          s.currentAyah > 0 &&
          s.currentAyah < s.versesCount &&
          duration > 0 &&
          audio.currentTime >= duration * 0.45
        ) {
          const session = sessionRef.current
          preloadAhead(s.surahId, s.currentAyah, s.versesCount, session)
        }
        return {
          ...s,
          currentTime: audio.currentTime,
          duration,
        }
      })
    }

    const onError = () => {
      setState((s) => {
        if (!s.surahId) return s
        const session = sessionRef.current
        if (s.currentAyah < s.versesCount) {
          void playAyah(s.surahId, s.currentAyah + 1, s.versesCount, s.surahName, session, {
            seamless: true,
          })
        } else {
          return { ...s, playing: false, loading: false }
        }
        return { ...s, loading: false, error: `Skipped ayah ${s.currentAyah}` }
      })
    }

    audio.addEventListener('ended', onEnded)
    audio.addEventListener('error', onError)
    audio.addEventListener('loadedmetadata', onLoadedMetadata)
    audio.addEventListener('timeupdate', onTimeUpdate)

    return () => {
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('error', onError)
      audio.removeEventListener('loadedmetadata', onLoadedMetadata)
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.pause()
      clearMainObjectUrl()
      clearPreload()
      audio.src = ''
    }
  }, [clearMainObjectUrl, clearPreload, playAyah, preloadAhead])

  useEffect(() => {
    if (reciterRef.current === reciterId) return
    reciterRef.current = reciterId
    clearPreload()

    setState((s) => {
      if (!s.surahId || !s.currentAyah) return s
      const session = sessionRef.current
      void playAyah(s.surahId, s.currentAyah, s.versesCount, s.surahName, session)
      return { ...s, loading: true, error: null }
    })
  }, [reciterId, clearPreload, playAyah])

  const surahProgress =
    state.versesCount > 0 && state.currentAyah > 0
      ? Math.min(
          100,
          Math.round(
            ((state.currentAyah - 1 +
              (state.duration > 0 ? state.currentTime / state.duration : 0)) /
              state.versesCount) *
              100
          )
        )
      : 0

  return {
    state,
    surahProgress,
    playSurah,
    togglePlayPause,
    seekRelative,
    seekTo,
    stop,
    isActiveSurah: (surahId: number) => state.surahId === surahId,
  }
}
