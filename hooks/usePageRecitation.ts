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
}

export function usePageRecitation({ reciterId, verses }: UsePageRecitationOptions) {
  const [state, setState] = useState<PageRecitationState>(idleState)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const sessionRef = useRef(0)
  const indexRef = useRef(0)
  const versesRef = useRef(verses)
  const reciterRef = useRef(reciterId)
  const playModeRef = useRef<'page' | 'single'>('page')
  const playingRef = useRef(false)

  versesRef.current = verses
  reciterRef.current = reciterId
  playingRef.current = state.playing

  const stop = useCallback(() => {
    sessionRef.current += 1
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.src = ''
    }
    indexRef.current = 0
    playModeRef.current = 'page'
    setState(idleState)
  }, [])

  const finishPlayback = useCallback(() => {
    sessionRef.current += 1
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.src = ''
    }
    indexRef.current = 0
    playModeRef.current = 'page'
    setState(idleState)
  }, [])

  const playIndex = useCallback(async (index: number, session: number) => {
    const audio = audioRef.current
    const list = versesRef.current
    if (!audio || session !== sessionRef.current) return

    if (index >= list.length) {
      finishPlayback()
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
        highlightedVerseKey: null,
        error: `Could not play ayah ${ayah}`,
      }))
    }
  }, [finishPlayback])

  const start = useCallback(() => {
    stop()
    playModeRef.current = 'page'
    sessionRef.current += 1
    void playIndex(0, sessionRef.current)
  }, [playIndex, stop])

  const playVerse = useCallback(
    (verseKey: string) => {
      const index = versesRef.current.findIndex((v) => v.verse_key === verseKey)
      if (index < 0) return
      stop()
      playModeRef.current = 'single'
      sessionRef.current += 1
      void playIndex(index, sessionRef.current)
    },
    [playIndex, stop]
  )

  useEffect(() => {
    const audio = new Audio()
    audioRef.current = audio

    const onEnded = () => {
      if (playModeRef.current === 'single') {
        finishPlayback()
        return
      }
      void playIndex(indexRef.current + 1, sessionRef.current)
    }

    const onError = () => {
      if (playModeRef.current === 'single') {
        finishPlayback()
        return
      }
      const next = indexRef.current + 1
      if (next < versesRef.current.length) {
        void playIndex(next, sessionRef.current)
      } else {
        finishPlayback()
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
  }, [finishPlayback, playIndex])

  useEffect(() => {
    const versesKey = verses.map((v) => v.verse_key).join(',')
    if (!versesKey) return
    sessionRef.current += 1
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.src = ''
    }
    indexRef.current = 0
    playModeRef.current = 'page'
    setState(idleState)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verses.map((v) => v.verse_key).join(',')])

  useEffect(() => {
    if (!playingRef.current) return
    sessionRef.current += 1
    void playIndex(indexRef.current, sessionRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reciterId])

  return { state, stop, start, playVerse }
}
