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

interface UsePageRecitationOptions {
  reciterId: string
  verses: Verse[]
}

export function usePageRecitation({ reciterId, verses }: UsePageRecitationOptions) {
  const [state, setState] = useState<PageRecitationState>(idleState)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  /** Bumped on stop / new playback — in-flight playIndex calls must match this. */
  const sessionRef = useRef(0)
  /** Session id for the ayah currently loaded in the audio element. */
  const playbackSessionRef = useRef(0)
  const indexRef = useRef(0)
  const versesRef = useRef(verses)
  const reciterRef = useRef(reciterId)
  const playModeRef = useRef<'page' | 'single'>('page')
  const abortingRef = useRef(false)
  const objectUrlRef = useRef<string | null>(null)

  versesRef.current = verses
  reciterRef.current = reciterId

  const stop = useCallback(() => {
    sessionRef.current += 1
    abortingRef.current = true
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      if (objectUrlRef.current) {
        revokePlayableAyahAudioUrl(objectUrlRef.current)
        objectUrlRef.current = null
      }
      audio.removeAttribute('src')
      audio.load()
    }
    abortingRef.current = false
    indexRef.current = 0
    playModeRef.current = 'page'
    playbackSessionRef.current = 0
    setState(idleState)
  }, [])

  const finishPlayback = useCallback(() => {
    sessionRef.current += 1
    abortingRef.current = true
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      if (objectUrlRef.current) {
        revokePlayableAyahAudioUrl(objectUrlRef.current)
        objectUrlRef.current = null
      }
      audio.removeAttribute('src')
      audio.load()
    }
    abortingRef.current = false
    indexRef.current = 0
    playModeRef.current = 'page'
    playbackSessionRef.current = 0
    setState(idleState)
  }, [])

  const playIndex = useCallback(
    async (index: number, session: number) => {
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
      playbackSessionRef.current = session
      const folder = getReciterById(reciterRef.current).folder
      const url = await getPlayableAyahAudioUrl(folder, surah, ayah)

      setState((s) => ({
        ...s,
        playing: true,
        loading: true,
        highlightedVerseKey: verse.verse_key,
        error: null,
      }))

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
          highlightedVerseKey: null,
          error: `Could not play ayah ${ayah}`,
        }))
      }
    },
    [finishPlayback]
  )

  const start = useCallback(() => {
    sessionRef.current += 1
    playModeRef.current = 'page'
    indexRef.current = 0
    void playIndex(0, sessionRef.current)
  }, [playIndex])

  const playVerse = useCallback(
    (verseKey: string, options?: { continueOnPage?: boolean }) => {
      const index = versesRef.current.findIndex((v) => v.verse_key === verseKey)
      if (index < 0) return
      sessionRef.current += 1
      playModeRef.current = options?.continueOnPage === false ? 'single' : 'page'
      indexRef.current = index
      void playIndex(index, sessionRef.current)
    },
    [playIndex]
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
      void playIndex(indexRef.current + 1, session)
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
        void playIndex(next, session)
      } else {
        finishPlayback()
      }
    }

    audio.addEventListener('ended', onEnded)
    audio.addEventListener('error', onError)

    return () => {
      abortingRef.current = true
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('error', onError)
      audio.pause()
      if (objectUrlRef.current) {
        revokePlayableAyahAudioUrl(objectUrlRef.current)
        objectUrlRef.current = null
      }
      audio.removeAttribute('src')
      audio.load()
      abortingRef.current = false
    }
  }, [finishPlayback, playIndex])

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
    void playIndex(indexRef.current, sessionRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reciterId])

  const isActive = state.playing || state.loading

  return { state, stop, start, playVerse, isActive }
}
