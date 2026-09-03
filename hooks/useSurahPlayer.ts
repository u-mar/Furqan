'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getPlayableListenSurahAudioUrl,
  OFFLINE_AUDIO_HINT,
  revokePlayableAyahAudioUrl,
} from '@/lib/offline-audio'

export interface SurahPlayerState {
  surahId: number | null
  surahName: string
  versesCount: number
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

  const clearMainObjectUrl = useCallback(() => {
    if (objectUrlRef.current) {
      revokePlayableAyahAudioUrl(objectUrlRef.current)
      objectUrlRef.current = null
    }
  }, [])

  const stop = useCallback(() => {
    sessionRef.current += 1
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      clearMainObjectUrl()
      audio.src = ''
    }
    setState(initialState)
  }, [clearMainObjectUrl])

  const playSurahFile = useCallback(
    async (
      surahId: number,
      surahName: string,
      versesCount: number,
      session: number,
      resumeAt = 0
    ) => {
      const audio = audioRef.current
      if (!audio || session !== sessionRef.current) return

      setState({
        surahId,
        surahName,
        versesCount,
        currentTime: resumeAt,
        duration: 0,
        playing: true,
        loading: true,
        error: null,
      })

      const url = await getPlayableListenSurahAudioUrl(reciterRef.current, surahId)
      if (!url || session !== sessionRef.current) {
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
        if (url.startsWith('blob:')) objectUrlRef.current = url
        audio.src = url
        // Same surah, different narration/reciter — pick up where you left off
        // instead of restarting from the top.
        if (resumeAt > 0) audio.currentTime = resumeAt
        await audio.play()
        if (session !== sessionRef.current) return
        if (resumeAt > 0) audio.currentTime = resumeAt
        setState((s) => ({ ...s, loading: false }))
      } catch {
        if (session !== sessionRef.current) return
        setState((s) => ({
          ...s,
          loading: false,
          playing: false,
          error: 'Could not play surah',
        }))
      }
    },
    [clearMainObjectUrl]
  )

  const playSurah = useCallback(
    (surahId: number, surahName: string, versesCount: number) => {
      sessionRef.current += 1
      void playSurahFile(surahId, surahName, versesCount, sessionRef.current)
    },
    [playSurahFile]
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

    audio
      .play()
      .then(() => setState((s) => ({ ...s, playing: true, error: null })))
      .catch(() => setState((s) => ({ ...s, error: 'Playback failed' })))
  }, [state.loading, state.playing, state.surahId])

  useEffect(() => {
    const audio = new Audio()
    audioRef.current = audio

    const onEnded = () => {
      setState((s) => ({ ...s, playing: false, loading: false }))
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
      setState((s) => ({ ...s, playing: false, loading: false, error: 'Playback failed' }))
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
      audio.src = ''
    }
  }, [clearMainObjectUrl])

  useEffect(() => {
    if (reciterRef.current === reciterId) return
    reciterRef.current = reciterId

    setState((s) => {
      if (!s.surahId) return s
      const session = sessionRef.current
      // Switching narration (e.g. Hafs → Susi) for the same reciter/surah should
      // pick up at the same spot rather than restarting the surah.
      void playSurahFile(s.surahId, s.surahName, s.versesCount, session, s.currentTime)
      return { ...s, loading: true, error: null }
    })
  }, [reciterId, playSurahFile])

  return {
    state,
    playSurah,
    togglePlayPause,
    seekRelative,
    seekTo,
    stop,
    isActiveSurah: (surahId: number) => state.surahId === surahId,
  }
}
