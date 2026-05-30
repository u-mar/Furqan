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

export function useSurahPlayer(reciterId: string) {
  const [state, setState] = useState<SurahPlayerState>(initialState)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const sessionRef = useRef(0)
  const reciterRef = useRef(reciterId)
  const objectUrlRef = useRef<string | null>(null)

  const reciterFolder = getReciterById(reciterId).folder

  const stop = useCallback(() => {
    sessionRef.current += 1
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      if (objectUrlRef.current) {
        revokePlayableAyahAudioUrl(objectUrlRef.current)
        objectUrlRef.current = null
      }
      audio.src = ''
    }
    setState(initialState)
  }, [])

  const playAyah = useCallback(
    async (surahId: number, ayah: number, versesCount: number, surahName: string, session: number) => {
      const audio = audioRef.current
      if (!audio || session !== sessionRef.current) return

      if (ayah > versesCount) {
        setState((s) => ({ ...s, playing: false, loading: false, currentAyah: versesCount }))
        return
      }

      setState((s) => ({
        ...s,
        surahId,
        surahName,
        versesCount,
        currentAyah: ayah,
        currentTime: 0,
        duration: 0,
        playing: true,
        loading: true,
        error: null,
      }))

      const url = await getPlayableAyahAudioUrl(reciterFolder, surahId, ayah)

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
        if (objectUrlRef.current) {
          revokePlayableAyahAudioUrl(objectUrlRef.current)
          objectUrlRef.current = null
        }
        if (url.startsWith('blob:')) objectUrlRef.current = url
        audio.src = url
        await audio.play()
        if (session !== sessionRef.current) return
        setState((s) => ({ ...s, loading: false }))
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
    [reciterFolder]
  )

  const playSurah = useCallback(
    (surahId: number, surahName: string, versesCount: number) => {
      sessionRef.current += 1
      const session = sessionRef.current
      void playAyah(surahId, 1, versesCount, surahName, session)
    },
    [playAyah]
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
        void playAyah(s.surahId, nextAyah, s.versesCount, s.surahName, session)
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
      setState((s) => ({
        ...s,
        currentTime: audio.currentTime,
        duration: Number.isFinite(audio.duration) ? audio.duration : s.duration,
      }))
    }

    const onError = () => {
      setState((s) => {
        if (!s.surahId) return s
        const session = sessionRef.current
        if (s.currentAyah < s.versesCount) {
          void playAyah(s.surahId, s.currentAyah + 1, s.versesCount, s.surahName, session)
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
      if (objectUrlRef.current) {
        revokePlayableAyahAudioUrl(objectUrlRef.current)
        objectUrlRef.current = null
      }
      audio.src = ''
    }
  }, [playAyah])

  useEffect(() => {
    if (reciterRef.current === reciterId) return
    reciterRef.current = reciterId

    setState((s) => {
      if (!s.surahId || !s.currentAyah) return s
      const session = sessionRef.current
      void playAyah(s.surahId, s.currentAyah, s.versesCount, s.surahName, session)
      return { ...s, loading: true, error: null }
    })
  }, [reciterId, playAyah])

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
