'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { everyAyahAudioUrl, getReciterById } from '@/lib/reciters'
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

interface UsePageRecitationOptions {
  reciterId: string
  verses: Verse[]
  onPageFinished?: () => void
}

export function usePageRecitation({ reciterId, verses, onPageFinished }: UsePageRecitationOptions) {
  const [state, setState] = useState<PageRecitationState>(idleState)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const sessionRef = useRef(0)
  const indexRef = useRef(0)
  const versesRef = useRef(verses)
  const reciterRef = useRef(reciterId)
  const onPageFinishedRef = useRef(onPageFinished)

  versesRef.current = verses
  onPageFinishedRef.current = onPageFinished
  reciterRef.current = reciterId

  const stop = useCallback(() => {
    sessionRef.current += 1
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.src = ''
    }
    indexRef.current = 0
    setState(idleState)
  }, [])

  const playIndex = useCallback(async (index: number, session: number) => {
    const audio = audioRef.current
    const list = versesRef.current
    if (!audio || session !== sessionRef.current) return

    if (index >= list.length) {
      setState((s) => ({ ...s, playing: false, loading: false, highlightedVerseKey: null }))
      onPageFinishedRef.current?.()
      return
    }

    const verse = list[index]
    const parts = verse.verse_key.split(':')
    const surah = Number(parts[0])
    const ayah = Number(parts[1])
    if (!surah || !ayah) return

    indexRef.current = index
    const folder = getReciterById(reciterRef.current).folder
    const url = everyAyahAudioUrl(folder, surah, ayah)

    setState((s) => ({
      ...s,
      playing: true,
      loading: true,
      highlightedVerseKey: verse.verse_key,
      error: null,
    }))

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
  }, [])

  const start = useCallback(() => {
    sessionRef.current += 1
    void playIndex(0, sessionRef.current)
  }, [playIndex])

  const toggle = useCallback(() => {
    if (state.loading) return

    if (state.playing) {
      audioRef.current?.pause()
      setState((s) => ({ ...s, playing: false }))
      return
    }

    if (state.highlightedVerseKey) {
      audioRef.current
        ?.play()
        .then(() => setState((s) => ({ ...s, playing: true, error: null })))
        .catch(() => setState((s) => ({ ...s, error: 'Playback failed' })))
      return
    }

    start()
  }, [start, state.highlightedVerseKey, state.loading, state.playing])

  useEffect(() => {
    const audio = new Audio()
    audioRef.current = audio

    const onEnded = () => {
      void playIndex(indexRef.current + 1, sessionRef.current)
    }

    const onError = () => {
      const next = indexRef.current + 1
      if (next < versesRef.current.length) {
        void playIndex(next, sessionRef.current)
      } else {
        setState((s) => ({ ...s, playing: false, loading: false, highlightedVerseKey: null }))
      }
    }

    audio.addEventListener('ended', onEnded)
    audio.addEventListener('error', onError)

    return () => {
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('error', onError)
      audio.pause()
      audio.src = ''
    }
  }, [playIndex])

  useEffect(() => {
    if (!state.highlightedVerseKey) return
    sessionRef.current += 1
    void playIndex(indexRef.current, sessionRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reciterId])

  return { state, toggle, stop, start }
}
