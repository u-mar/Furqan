'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { downloadQariAsrModel, isQariAsrModelReady, onQariAsrModelChange } from '@/lib/asr/offline-model-cache'
import { markRecitationAyat } from '@/lib/qari-ayah-marks'
import type { VerseTimelineEntry } from '@/lib/qari'
import { tr } from '@/lib/i18n-core'
import { toast } from '@/lib/toast'

export type MarkingStatus = 'idle' | 'downloading' | 'running' | 'done' | 'none' | 'failed'

/**
 * Marks the ayat in a recording on the phone (see lib/qari-ayah-marks.ts),
 * one job at a time, and says how it is going. Starting another, or leaving,
 * lets go of the one in progress.
 */
export function useAyahMarking(onMarked: (timeline: VerseTimelineEntry[]) => void) {
  const [modelReady, setModelReady] = useState(false)
  const [status, setStatus] = useState<MarkingStatus>('idle')
  const [progress, setProgress] = useState(0)
  const [count, setCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const jobRef = useRef<{ cancelled: boolean } | null>(null)
  const onMarkedRef = useRef(onMarked)
  onMarkedRef.current = onMarked

  useEffect(() => {
    setModelReady(isQariAsrModelReady())
    return onQariAsrModelChange(() => setModelReady(isQariAsrModelReady()))
  }, [])

  const cancel = useCallback(() => {
    if (jobRef.current) jobRef.current.cancelled = true
    jobRef.current = null
  }, [])

  useEffect(() => cancel, [cancel])

  const reset = useCallback(() => {
    cancel()
    setStatus('idle')
    setProgress(0)
    setCount(0)
    setError(null)
  }, [cancel])

  const start = useCallback(
    async (blob: Blob) => {
      cancel()
      const job = { cancelled: false }
      jobRef.current = job
      setStatus('running')
      setProgress(0)
      setError(null)
      try {
        const result = await markRecitationAyat(blob, {
          signal: job,
          onProgress: (fraction) => {
            if (!job.cancelled) setProgress(fraction)
          },
        })
        if (job.cancelled) return
        if (!result) {
          setStatus('none')
          return
        }
        setCount(new Set(result.timeline.map((e) => e.verseKey)).size)
        setStatus('done')
        onMarkedRef.current(result.timeline)
      } catch (err) {
        if (job.cancelled) return
        const message = err instanceof Error && err.message ? err.message : tr('Could not mark the ayat.')
        setStatus('failed')
        setError(message)
        // Said out loud: a marking that quietly does nothing looks like it never ran.
        toast(message, 'error')
      } finally {
        if (jobRef.current === job) jobRef.current = null
      }
    },
    [cancel]
  )

  /**
   * Saves the model (a one-time download, about 460 MB), then marks `blob`'s ayat.
   * Progress is the download's, then the listening's.
   */
  const downloadAndStart = useCallback(
    async (blob: Blob) => {
      cancel()
      const job = { cancelled: false }
      jobRef.current = job
      setStatus('downloading')
      setProgress(0)
      setError(null)
      try {
        await downloadQariAsrModel((p) => {
          if (!job.cancelled) setProgress(p.percent / 100)
        })
      } catch (err) {
        if (job.cancelled) return
        setStatus('failed')
        setError(err instanceof Error && err.message ? err.message : tr('Download failed'))
        return
      } finally {
        if (jobRef.current === job) jobRef.current = null
      }
      if (job.cancelled) return
      setModelReady(true)
      await start(blob)
    },
    [cancel, start]
  )

  return { modelReady, status, progress, count, error, start, downloadAndStart, cancel, reset }
}
