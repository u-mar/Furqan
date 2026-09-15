'use client'

import { useEffect } from 'react'
import { isHalaqaMember, markReadToday, readTodayOnThisPhone } from '@/lib/halaqa'

/** How long a page has to stay open to count as reading it, rather than passing by. */
const READ_AFTER_MS = 20_000

/**
 * Ticks "Have you read today?" in the halaqas this phone is in, once a page of
 * the mushaf has been on screen long enough to have been read. Time with the
 * app in the background does not count: the wait starts again when it comes
 * back. Does nothing for someone in no halaqa, and asks the server at most
 * once a day.
 */
export function useHalaqaReadingTick(page: number) {
  useEffect(() => {
    if (!page || !isHalaqaMember() || readTodayOnThisPhone()) return
    let timer: number | undefined

    const start = () => {
      window.clearTimeout(timer)
      if (document.visibilityState !== 'visible') return
      timer = window.setTimeout(() => {
        if (readTodayOnThisPhone()) return
        void markReadToday('app').catch(() => {
          // Offline, or no longer in a halaqa: the next page tries again.
        })
      }, READ_AFTER_MS)
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') start()
      else window.clearTimeout(timer)
    }

    start()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [page])
}
