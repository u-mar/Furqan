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
const LOAD_TIMEOUT_MS = 30_000

interface UseSomaliVoicePlaybackOptions {
  onSegmentEnd?: (segment: SomaliVoiceSegment) => void
}

function waitForAudioCanPlay(audio: HTMLAudioElement, timeoutMs: number): Promise<void> {
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
      reject(new Error('Audio failed to load'))
    }
    const onTimeout = () => {
      cleanup()
      reject(new Error('Audio load timed out'))
    }

    const cleanup = () => {
      clearTimeout(timer)
      audio.removeEventListener('canplay', onReady)
      audio.removeEventListener('error', onFail)
    }

    const timer = setTimeout(onTimeout, timeoutMs)
    audio.addEventListener('canplay', onReady, { once: true })
    audio.addEventListener('error', onFail, { once: true })
  })
}

function waitForSeek(audio: HTMLAudioElement, target: number): Promise<void> {
  if (Math.abs(audio.currentTime - target) <= 0.25) {
    return Promise.resolve()
  }

  return new Promise((resolve, reject) => {
    const onSeeked = () => {
      cleanup()
      resolve()
    }
    const onError = () => {
      cleanup()
      reject(new Error('Seek failed'))
    }
    const cleanup = () => {
      audio.removeEventListener('seeked', onSeeked)
      audio.removeEventListener('error', onError)
    }
    audio.addEventListener('seeked', onSeeked)
    audio.addEventListener('error', onError)
    audio.currentTime = target
  })
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

  const fail = useCallback((session: number, message: string) => {
    if (session !== sessionRef.current) return
    setState({
      playing: false,
      loading: false,
      verseKey: null,
      error: message,
    })
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
      const seamlessSameFile = sameFile && !segment.wholeFile

      setState({
        playing: seamlessSameFile,
        loading: !seamlessSameFile,
        verseKey,
        error: null,
      })

      const startPlayback = async () => {
        try {
          if (!segment.wholeFile) {
            await waitForSeek(audio, Math.max(0, segment.start))
          } else {
            audio.currentTime = 0
          }

          await audio.play()
          if (session !== sessionRef.current) return
          setState({ playing: true, loading: false, verseKey, error: null })
        } catch {
          fail(session, 'Could not play Somali voice.')
        }
      }

      try {
        if (!sameFile) {
          loadedFileRef.current = segment.file
          audio.preload = segment.wholeFile ? 'auto' : 'metadata'
          audio.src = segment.audioUrl
          audio.load()
          await waitForAudioCanPlay(audio, LOAD_TIMEOUT_MS)
          if (session !== sessionRef.current) return false
        }

        await startPlayback()
        if (session !== sessionRef.current) return false
        return true
      } catch {
        fail(session, 'Could not load Somali voice audio.')
        return false
      }
    },
    [fail]
  )

  useEffect(() => {
    const audio = new Audio()
    audio.preload = 'metadata'
    audioRef.current = audio

    const onTimeUpdate = () => {
      const segment = segmentRef.current
      if (!segment || sessionRef.current === 0 || segment.wholeFile) return
      if (audio.currentTime >= segment.end - END_PADDING_SEC) {
        audio.pause()
        const ended = segmentRef.current
        segmentRef.current = null
        if (ended) onSegmentEndRef.current?.(ended)
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
