'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getSomaliVoiceSegment,
  TAFSIR_UNAVAILABLE_MESSAGE,
  type SomaliVoiceSegment,
} from '@/lib/somali-voice'

export interface SomaliVoicePlaybackState {
  playing: boolean
  loading: boolean
  verseKey: string | null
  error: string | null
}

const idleState: SomaliVoicePlaybackState = {
  playing: false,
  loading: false,
  verseKey: null,
  error: null,
}

const END_PADDING_SEC = 0.05

interface UseSomaliVoicePlaybackOptions {
  onSegmentEnd?: (segment: SomaliVoiceSegment) => void
}

export function useSomaliVoicePlayback(options: UseSomaliVoicePlaybackOptions = {}) {
  const [state, setState] = useState<SomaliVoicePlaybackState>(idleState)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const segmentRef = useRef<SomaliVoiceSegment | null>(null)
  const loadedFileRef = useRef<string | null>(null)
  const sessionRef = useRef(0)
  const onSegmentEndRef = useRef(options.onSegmentEnd)

  useEffect(() => {
    onSegmentEndRef.current = options.onSegmentEnd
  }, [options.onSegmentEnd])

  const stop = useCallback(() => {
    sessionRef.current += 1
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
    }
    segmentRef.current = null
    loadedFileRef.current = null
    setState(idleState)
  }, [])

  const playVerse = useCallback(
    async (verseKey: string) => {
      const segment = await getSomaliVoiceSegment(verseKey)
      if (!segment) {
        setState({
          playing: false,
          loading: false,
          verseKey: null,
          error: TAFSIR_UNAVAILABLE_MESSAGE,
        })
        return false
      }

      sessionRef.current += 1
      const session = sessionRef.current
      const audio = audioRef.current
      if (!audio) return false

      segmentRef.current = segment

      const sameFile = loadedFileRef.current === segment.file && Boolean(audio.src)

      setState({
        playing: false,
        loading: true,
        verseKey,
        error: null,
      })

      const startPlayback = async () => {
        try {
          audio.currentTime = Math.max(0, segment.start)
          await audio.play()
          if (session !== sessionRef.current) return
          setState({ playing: true, loading: false, verseKey, error: null })
        } catch {
          if (session !== sessionRef.current) return
          setState({
            playing: false,
            loading: false,
            verseKey: null,
            error: 'Could not play Somali voice.',
          })
        }
      }

      if (!sameFile) {
        loadedFileRef.current = segment.file
        audio.src = segment.audioUrl
        const onLoaded = () => {
          audio.removeEventListener('loadedmetadata', onLoaded)
          if (session !== sessionRef.current) return
          void startPlayback()
        }
        audio.addEventListener('loadedmetadata', onLoaded)
        audio.load()
      } else {
        void startPlayback()
      }
      return true
    },
    []
  )

  useEffect(() => {
    const audio = new Audio()
    audioRef.current = audio

    const onTimeUpdate = () => {
      const segment = segmentRef.current
      if (!segment || sessionRef.current === 0) return
      if (audio.currentTime >= segment.end - END_PADDING_SEC) {
        audio.pause()
        segmentRef.current = null
        setState(idleState)
        onSegmentEndRef.current?.(segment)
      }
    }

    const onEnded = () => {
      const segment = segmentRef.current
      segmentRef.current = null
      setState(idleState)
      if (segment) onSegmentEndRef.current?.(segment)
    }

    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('ended', onEnded)

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('ended', onEnded)
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
    }
  }, [])

  return {
    state,
    playVerse,
    stop,
    isActive: state.playing || state.loading,
  }
}
