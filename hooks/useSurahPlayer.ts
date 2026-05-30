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

interface PreloadedAyah {
  surahId: number
  ayah: number
  url: string
  audio: HTMLAudioElement
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
  const preloadRef = useRef<PreloadedAyah | null>(null)
  const preloadObjectUrlRef = useRef<string | null>(null)
  const preloadingRef = useRef(false)

  const reciterFolder = getReciterById(reciterId).folder

  const clearPreload = useCallback(() => {
    const pre = preloadRef.current
    if (pre) {
      pre.audio.pause()
      pre.audio.src = ''
      preloadRef.current = null
    }
    if (preloadObjectUrlRef.current) {
      revokePlayableAyahAudioUrl(preloadObjectUrlRef.current)
      preloadObjectUrlRef.current = null
    }
  }, [])

  const clearMainObjectUrl = useCallback(() => {
    if (objectUrlRef.current) {
      revokePlayableAyahAudioUrl(objectUrlRef.current)
      objectUrlRef.current = null
    }
  }, [])

  const preloadNextAyah = useCallback(
    async (surahId: number, ayah: number, versesCount: number, session: number) => {
      if (ayah > versesCount || session !== sessionRef.current) return
      if (preloadRef.current?.surahId === surahId && preloadRef.current.ayah === ayah) return
      if (preloadingRef.current) return

      preloadingRef.current = true
      try {
        const url = await getPlayableAyahAudioUrl(reciterFolder, surahId, ayah)
        if (!url || session !== sessionRef.current) return

        clearPreload()
        const preAudio = new Audio()
        preAudio.preload = 'auto'
        if (url.startsWith('blob:')) preloadObjectUrlRef.current = url
        preAudio.src = url
        await waitForAudioReady(preAudio)
        if (session !== sessionRef.current) {
          clearPreload()
          return
        }
        preloadRef.current = { surahId, ayah, url, audio: preAudio }
      } catch {
        clearPreload()
      } finally {
        preloadingRef.current = false
      }
    },
    [clearPreload, reciterFolder]
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

      const pre = preloadRef.current
      const usePreload =
        options?.seamless &&
        pre?.surahId === surahId &&
        pre.ayah === ayah &&
        pre.audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA

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
        preloadRef.current = null
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
        if (url.startsWith('blob:')) {
          objectUrlRef.current = preloadObjectUrlRef.current ?? url
          preloadObjectUrlRef.current = null
        }
        audio.src = url
        await audio.play()
        if (session !== sessionRef.current) return
        setState((s) => ({ ...s, loading: false }))
        void preloadNextAyah(surahId, ayah + 1, versesCount, session)
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
    [clearMainObjectUrl, preloadNextAyah, reciterFolder]
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
          audio.currentTime >= duration * 0.55
        ) {
          const session = sessionRef.current
          void preloadNextAyah(s.surahId, s.currentAyah + 1, s.versesCount, session)
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
  }, [clearMainObjectUrl, clearPreload, playAyah, preloadNextAyah])

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
