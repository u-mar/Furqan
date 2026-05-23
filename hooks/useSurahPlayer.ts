'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { everyAyahAudioUrl, getReciterById } from '@/lib/reciters'

export interface SurahPlayerState {
  surahId: number | null
  surahName: string
  versesCount: number
  currentAyah: number
  playing: boolean
  loading: boolean
  error: string | null
}

const initialState: SurahPlayerState = {
  surahId: null,
  surahName: '',
  versesCount: 0,
  currentAyah: 0,
  playing: false,
  loading: false,
  error: null,
}

export function useSurahPlayer(reciterId: string) {
  const [state, setState] = useState<SurahPlayerState>(initialState)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const sessionRef = useRef(0)
  const reciterRef = useRef(reciterId)

  const reciterFolder = getReciterById(reciterId).folder

  const stop = useCallback(() => {
    sessionRef.current += 1
    const audio = audioRef.current
    if (audio) {
      audio.pause()
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
        playing: true,
        loading: true,
        error: null,
      }))

      const url = everyAyahAudioUrl(reciterFolder, surahId, ayah)

      try {
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

    return () => {
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('error', onError)
      audio.pause()
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

  return {
    state,
    playSurah,
    togglePlayPause,
    stop,
    isActiveSurah: (surahId: number) => state.surahId === surahId,
  }
}
