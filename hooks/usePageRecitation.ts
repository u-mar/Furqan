'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { getReciterById, isSurahOnlyReciter, SURAH_ONLY_RECITER_HINT } from '@/lib/reciters'
import { getChapterAudio, hasTimedAudio, type ChapterAudio } from '@/lib/chapter-audio'
import { getPlayableAyahAudioUrl, revokePlayableAyahAudioUrl } from '@/lib/offline-audio'
import type { Verse } from '@/types'
import { tr } from '@/lib/i18n-core'

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

const PRELOAD_AHEAD = 2

interface UsePageRecitationOptions {
  reciterId: string
  verses: Verse[]
  onPageFinished?: () => void
  /** Fires when a single-ayah play (`continueOnPage: false`) reaches its end or fails. */
  onSingleVerseEnd?: (verseKey: string) => void
  /** When true, verse list swap resumes playback instead of stopping (auto page advance). */
  resumeOnPageChangeRef?: import('react').MutableRefObject<boolean>
}

interface PreloadedClip {
  verseKey: string
  url: string
  audio: HTMLAudioElement
}

function parseVerseKey(verseKey: string): { surah: number; ayah: number } | null {
  const parts = verseKey.split(':')
  const surah = Number(parts[0])
  const ayah = Number(parts[1])
  if (!surah || !ayah) return null
  return { surah, ayah }
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
      reject(new Error(tr('Audio preload failed')))
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

export function usePageRecitation({
  reciterId,
  verses,
  onPageFinished,
  onSingleVerseEnd,
  resumeOnPageChangeRef,
}: UsePageRecitationOptions) {
  const [state, setState] = useState<PageRecitationState>(idleState)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const sessionRef = useRef(0)
  const playbackSessionRef = useRef(0)
  const indexRef = useRef(0)
  const versesRef = useRef(verses)
  const reciterRef = useRef(reciterId)
  const playModeRef = useRef<'page' | 'single'>('page')
  const onPageFinishedRef = useRef(onPageFinished)
  const onSingleVerseEndRef = useRef(onSingleVerseEnd)
  const abortingRef = useRef(false)
  const objectUrlRef = useRef<string | null>(null)
  const preloadMapRef = useRef<Map<string, PreloadedClip>>(new Map())
  const preloadBlobUrlsRef = useRef<Map<string, string>>(new Map())
  const preloadingKeysRef = useRef<Set<string>>(new Set())
  const pausedRef = useRef(false)
  const [isPaused, setIsPaused] = useState(false)
  // Gapless mode: the whole surah is one recording and the ayat are followed by their timings,
  // so nothing is loaded between them and there is no silence to hear.
  const timedRef = useRef<ChapterAudio | null>(null)
  const timedDisabledRef = useRef(false)
  const pageEndFiredRef = useRef(false)
  const tickRef = useRef<number | null>(null)

  versesRef.current = verses
  reciterRef.current = reciterId
  onPageFinishedRef.current = onPageFinished
  onSingleVerseEndRef.current = onSingleVerseEnd

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

  const takePreloaded = useCallback((verseKey: string): PreloadedClip | null => {
    const pre = preloadMapRef.current.get(verseKey)
    if (!pre || pre.audio.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) return null
    preloadMapRef.current.delete(verseKey)
    pre.audio.pause()
    pre.audio.src = ''
    return pre
  }, [])

  const preloadAtIndex = useCallback(async (index: number, session: number) => {
    const list = versesRef.current
    if (index >= list.length || session !== sessionRef.current) return

    const verse = list[index]
    const verseKey = verse.verse_key
    if (preloadMapRef.current.has(verseKey) || preloadingKeysRef.current.has(verseKey)) return

    const parsed = parseVerseKey(verseKey)
    if (!parsed) return

    preloadingKeysRef.current.add(verseKey)
    try {
      const url = await getPlayableAyahAudioUrl(reciterRef.current, parsed.surah, parsed.ayah)
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

      preloadMapRef.current.set(verseKey, { verseKey, url, audio: preAudio })
      if (url.startsWith('blob:')) preloadBlobUrlsRef.current.set(verseKey, url)
    } catch {
      /* next ayah will load on demand */
    } finally {
      preloadingKeysRef.current.delete(verseKey)
    }
  }, [])

  const preloadAheadFromIndex = useCallback(
    (index: number, session: number) => {
      for (let offset = 1; offset <= PRELOAD_AHEAD; offset++) {
        void preloadAtIndex(index + offset, session)
      }
    },
    [preloadAtIndex]
  )

  const stop = useCallback(() => {
    pausedRef.current = false
    setIsPaused(false)
    sessionRef.current += 1
    abortingRef.current = true
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      clearMainObjectUrl()
      audio.removeAttribute('src')
      audio.load()
    }
    clearPreload()
    abortingRef.current = false
    timedRef.current = null
    indexRef.current = 0
    playModeRef.current = 'page'
    playbackSessionRef.current = 0
    setState(idleState)
  }, [clearMainObjectUrl, clearPreload])

  const finishPlayback = useCallback(() => {
    pausedRef.current = false
    setIsPaused(false)
    sessionRef.current += 1
    abortingRef.current = true
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      clearMainObjectUrl()
      audio.removeAttribute('src')
      audio.load()
    }
    clearPreload()
    abortingRef.current = false
    timedRef.current = null
    indexRef.current = 0
    playModeRef.current = 'page'
    playbackSessionRef.current = 0
    setState(idleState)
  }, [clearMainObjectUrl, clearPreload])

  const handlePageEnd = useCallback(() => {
    if (playModeRef.current === 'page' && onPageFinishedRef.current) {
      finishPlayback()
      onPageFinishedRef.current()
      return true
    }
    finishPlayback()
    return false
  }, [finishPlayback])

  /**
   * Plays `verseKey` from the surah's one recording, starting at that ayah's timing. If the
   * recording is already loaded and playing, this only moves the position — usually not at
   * all, since the voice is already there. Returns false when there is no timing to use.
   */
  const playTimed = useCallback(
    async (index: number, session: number, verseKey: string, surah: number): Promise<boolean> => {
      const audio = audioRef.current
      if (!audio) return false
      const chapter = await getChapterAudio(reciterRef.current, surah)
      if (session !== sessionRef.current) return true
      const timing = chapter?.byKey.get(verseKey)
      if (!chapter || !timing) return false

      indexRef.current = index
      playbackSessionRef.current = session
      timedRef.current = chapter
      pageEndFiredRef.current = false

      const loaded = audio.getAttribute('src') === chapter.url && !audio.ended
      setState((s) => ({
        ...s,
        playing: true,
        loading: !loaded,
        highlightedVerseKey: verseKey,
        error: null,
      }))

      clearMainObjectUrl()
      const target = timing.from / 1000
      try {
        if (loaded) {
          // Already in the right place, so leave it alone: seeking would cause the very gap this avoids.
          if (Math.abs(audio.currentTime - target) > 0.45) audio.currentTime = target
        } else {
          audio.src = chapter.url
          await new Promise<void>((resolve, reject) => {
            const onMeta = () => {
              audio.removeEventListener('error', onFail)
              resolve()
            }
            const onFail = () => {
              audio.removeEventListener('loadedmetadata', onMeta)
              reject(new Error(tr('Audio preload failed')))
            }
            audio.addEventListener('loadedmetadata', onMeta, { once: true })
            audio.addEventListener('error', onFail, { once: true })
          })
          if (session !== sessionRef.current) return true
          audio.currentTime = target
        }
        await audio.play()
        if (session !== sessionRef.current) return true
        setState((s) => ({ ...s, loading: false }))
        return true
      } catch {
        if (session !== sessionRef.current) return true
        // The whole-surah recording would not play: use the ayah-by-ayah files for this reciter.
        timedDisabledRef.current = true
        timedRef.current = null
        audio.removeAttribute('src')
        return false
      }
    },
    [clearMainObjectUrl]
  )

  const playIndex = useCallback(
    async (index: number, session: number, options?: { seamless?: boolean }) => {
      const audio = audioRef.current
      const list = versesRef.current
      if (!audio || session !== sessionRef.current) return

      if (index >= list.length) {
        handlePageEnd()
        return
      }

      const verse = list[index]
      const parsed = parseVerseKey(verse.verse_key)
      if (!parsed) return

      if (hasTimedAudio(reciterRef.current) && !timedDisabledRef.current) {
        const handled = await playTimed(index, session, verse.verse_key, parsed.surah)
        if (handled || session !== sessionRef.current) return
      }
      timedRef.current = null

      indexRef.current = index
      playbackSessionRef.current = session

      const pre = options?.seamless ? takePreloaded(verse.verse_key) : null
      const usePreload = Boolean(pre)

      setState((s) => ({
        ...s,
        playing: true,
        loading: !usePreload,
        highlightedVerseKey: verse.verse_key,
        error: null,
      }))

      let url: string | null = null
      if (usePreload && pre) {
        url = pre.url
      } else {
        const folder = getReciterById(reciterRef.current).folder
        url = await getPlayableAyahAudioUrl(reciterRef.current, parsed.surah, parsed.ayah)
      }

      if (!url) {
        setState((s) => ({
          ...s,
          playing: false,
          loading: false,
          error: tr('Audio unavailable offline. Download this surah in Listen first.'),
        }))
        return
      }

      try {
        clearMainObjectUrl()
        const blobFromPreload = preloadBlobUrlsRef.current.get(verse.verse_key)
        if (blobFromPreload) {
          preloadBlobUrlsRef.current.delete(verse.verse_key)
          objectUrlRef.current = blobFromPreload
        } else if (url.startsWith('blob:')) {
          objectUrlRef.current = url
        }
        audio.src = url
        await audio.play()
        if (session !== sessionRef.current) return
        setState((s) => ({ ...s, loading: false }))
        if (playModeRef.current === 'page') {
          preloadAheadFromIndex(index, session)
        }
      } catch {
        if (session !== sessionRef.current) return
        setState((s) => ({
          ...s,
          loading: false,
          playing: false,
          highlightedVerseKey: null,
          error: tr('Could not play ayah {ayah}', { ayah: parsed.ayah }),
        }))
      }
    },
    [clearMainObjectUrl, handlePageEnd, playTimed, preloadAheadFromIndex, takePreloaded]
  )

  const pause = useCallback(() => {
    const audio = audioRef.current
    if (!audio?.src) return
    audio.pause()
    pausedRef.current = true
    setIsPaused(true)
    setState((s) => ({ ...s, playing: false, loading: false }))
  }, [])

  const start = useCallback(() => {
    if (isSurahOnlyReciter(getReciterById(reciterRef.current))) {
      setState({
        ...idleState,
        error: SURAH_ONLY_RECITER_HINT,
      })
      return
    }
    sessionRef.current += 1
    pausedRef.current = false
    setIsPaused(false)
    clearPreload()
    playModeRef.current = 'page'
    indexRef.current = 0
    void playIndex(0, sessionRef.current)
  }, [clearPreload, playIndex])

  const resume = useCallback(() => {
    const audio = audioRef.current
    if (!audio?.src) {
      pausedRef.current = false
      setIsPaused(false)
      start()
      return
    }
    pausedRef.current = false
    setIsPaused(false)
    const verse = versesRef.current[indexRef.current]
    setState((s) => ({
      ...s,
      playing: true,
      loading: false,
      error: null,
      highlightedVerseKey: verse?.verse_key ?? s.highlightedVerseKey,
    }))
    void audio.play().catch(() => {
      setState((s) => ({ ...s, playing: false, error: tr('Playback failed') }))
    })
  }, [start])

  const playVerse = useCallback(
    (verseKey: string, options?: { continueOnPage?: boolean }) => {
      if (isSurahOnlyReciter(getReciterById(reciterRef.current))) {
        setState({
          ...idleState,
          error: SURAH_ONLY_RECITER_HINT,
        })
        return
      }
      const index = versesRef.current.findIndex((v) => v.verse_key === verseKey)
      if (index < 0) return
      sessionRef.current += 1
      pausedRef.current = false
      setIsPaused(false)
      clearPreload()
      playModeRef.current = options?.continueOnPage === false ? 'single' : 'page'
      indexRef.current = index
      void playIndex(index, sessionRef.current)
    },
    [clearPreload, playIndex]
  )

  useEffect(() => {
    const audio = new Audio()
    audioRef.current = audio

    const finishSingle = () => {
      const verseKey = versesRef.current[indexRef.current]?.verse_key
      finishPlayback()
      if (verseKey) onSingleVerseEndRef.current?.(verseKey)
    }

    /** Follows the voice frame by frame: which ayah it is in, and when the page or a single ayah is done. */
    const tick = () => {
      tickRef.current = requestAnimationFrame(tick)
      const chapter = timedRef.current
      if (!chapter || abortingRef.current || audio.paused || pageEndFiredRef.current) return
      const session = playbackSessionRef.current
      if (session !== sessionRef.current) return

      const list = versesRef.current
      const from = indexRef.current
      const now = audio.currentTime * 1000
      const current = chapter.byKey.get(list[from]?.verse_key ?? '')
      if (!current) return

      if (playModeRef.current === 'single') {
        // One ayah only: stop exactly where it ends.
        if (now >= current.to - 20) {
          audio.pause()
          finishSingle()
        }
        return
      }

      let index = from
      while (index + 1 < list.length) {
        const next = chapter.byKey.get(list[index + 1].verse_key)
        if (next && now >= next.from - 15) index += 1
        else break
      }
      if (index !== from) {
        indexRef.current = index
        setState((s) => ({ ...s, highlightedVerseKey: list[index].verse_key }))
      }

      const last = chapter.byKey.get(list[list.length - 1]?.verse_key ?? '')
      const surahContinues = last ? chapter.ayat[chapter.ayat.length - 1].key !== last.key : false
      if (index === list.length - 1 && last && now >= last.to - 30 && surahContinues) {
        pageEndFiredRef.current = true
        // The recording keeps playing into the next page's first ayah; only the page turns.
        if (onPageFinishedRef.current) onPageFinishedRef.current()
        else {
          finishPlayback()
        }
      }
    }
    const startTick = () => {
      if (tickRef.current === null) tickRef.current = requestAnimationFrame(tick)
    }
    const stopTick = () => {
      if (tickRef.current !== null) cancelAnimationFrame(tickRef.current)
      tickRef.current = null
    }

    const onEnded = () => {
      if (abortingRef.current) return
      const session = playbackSessionRef.current
      if (session !== sessionRef.current) return

      if (timedRef.current) {
        // The surah's recording is over. A page that runs on into the next surah carries on with that one.
        stopTick()
        if (pageEndFiredRef.current) return
        if (playModeRef.current === 'single') {
          finishSingle()
          return
        }
        const next = indexRef.current + 1
        if (next < versesRef.current.length && !pageEndFiredRef.current) {
          void playIndex(next, session)
          return
        }
        handlePageEnd()
        return
      }

      if (playModeRef.current === 'single') {
        finishSingle()
        return
      }
      void playIndex(indexRef.current + 1, session, { seamless: true })
    }

    const onTimeUpdate = () => {
      if (abortingRef.current || playModeRef.current !== 'page' || timedRef.current) return
      const session = playbackSessionRef.current
      if (session !== sessionRef.current) return
      const duration = audio.duration
      if (!Number.isFinite(duration) || duration <= 0) return
      if (audio.currentTime < duration * 0.45) return
      preloadAheadFromIndex(indexRef.current, session)
    }

    const onError = () => {
      if (abortingRef.current) return
      const session = playbackSessionRef.current
      if (session !== sessionRef.current) return

      if (timedRef.current) {
        // The whole-surah recording failed part-way: carry on with the ayah-by-ayah files from here.
        timedDisabledRef.current = true
        timedRef.current = null
        stopTick()
        void playIndex(indexRef.current, session)
        return
      }

      if (playModeRef.current === 'single') {
        finishSingle()
        return
      }
      const next = indexRef.current + 1
      if (next < versesRef.current.length) {
        void playIndex(next, session, { seamless: true })
      } else {
        handlePageEnd()
      }
    }

    audio.addEventListener('ended', onEnded)
    audio.addEventListener('error', onError)
    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('play', startTick)
    audio.addEventListener('pause', stopTick)

    return () => {
      abortingRef.current = true
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('error', onError)
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('play', startTick)
      audio.removeEventListener('pause', stopTick)
      stopTick()
      timedRef.current = null
      audio.pause()
      clearMainObjectUrl()
      clearPreload()
      audio.removeAttribute('src')
      audio.load()
      abortingRef.current = false
    }
  }, [clearMainObjectUrl, clearPreload, finishPlayback, handlePageEnd, playIndex, preloadAheadFromIndex])

  useEffect(() => {
    if (resumeOnPageChangeRef?.current) {
      resumeOnPageChangeRef.current = false
      playModeRef.current = 'page'
      indexRef.current = 0
      void playIndex(0, sessionRef.current)
      return
    }
    // A page change also ends a paused recitation: Play on the new page must start that page,
    // not carry on from wherever the last one was left.
    if (!state.playing && !state.loading && !pausedRef.current) return
    pausedRef.current = false
    setIsPaused(false)
    sessionRef.current += 1
    abortingRef.current = true
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
    }
    clearPreload()
    abortingRef.current = false
    indexRef.current = 0
    playModeRef.current = 'page'
    playbackSessionRef.current = 0
    setState(idleState)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verses.map((v) => v.verse_key).join(',')])

  useEffect(() => {
    timedDisabledRef.current = false
    if (!state.playing && !state.loading) return
    pausedRef.current = false
    setIsPaused(false)
    sessionRef.current += 1
    clearPreload()
    timedRef.current = null
    void playIndex(indexRef.current, sessionRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reciterId])

  const isActive = state.playing || state.loading

  return { state, stop, pause, resume, start, playVerse, isActive, isPaused }
}
