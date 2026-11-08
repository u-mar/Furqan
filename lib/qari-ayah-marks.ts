'use client'

import type { VerseTimelineEntry } from '@/lib/qari'
import { tr } from '@/lib/i18n-core'

/**
 * Finds the ayat in a Qari recording. It goes to the speech service
 * (services/nadir-asr), which listens to it, matches what it heard to the
 * Quran text and times each word. Gives the same list the "Read from Mushaf"
 * overlay makes by hand, so the swipe view and share videos can show each ayah
 * as it is recited.
 */

/** Sending is the part that can be measured; the rest of the bar moves on while the service listens. */
const SENT_AT = 0.6
const WAITING_UP_TO = 0.95
/** Enough to send a long recording on a slow connection and for the service to wake up. */
const GIVE_UP_AFTER_MS = 5 * 60 * 1000

/** The ayat in `blob`, or null when nothing in it could be matched to the Quran with confidence. */
export async function markRecitationAyat(
  blob: Blob,
  owner: { username: string; userId: string },
  onProgress: (fraction: number) => void
): Promise<VerseTimelineEntry[] | null> {
  const failed = () => new Error(tr('Could not mark the ayat.'))

  const response = await fetch('/api/qari/marking-access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(owner),
  }).catch(() => null)
  if (!response?.ok) throw failed()
  const access = (await response.json().catch(() => null)) as { url?: string; token?: string } | null
  if (!access?.url || !access.token) throw failed()
  const { url, token } = access

  return new Promise((resolve, reject) => {
    const form = new FormData()
    form.append('audio', blob, 'recitation')

    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${url}/mark`)
    xhr.setRequestHeader('x-marking-token', token)
    xhr.responseType = 'json'
    xhr.timeout = GIVE_UP_AFTER_MS

    let fraction = 0
    let waiting: ReturnType<typeof setInterval> | undefined
    const report = (value: number) => {
      fraction = value
      onProgress(value)
    }

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) report((event.loaded / event.total) * SENT_AT)
    }
    xhr.upload.onload = () => {
      waiting = setInterval(() => report(fraction + (WAITING_UP_TO - fraction) * 0.06), 400)
    }
    const fail = () => {
      clearInterval(waiting)
      reject(failed())
    }
    xhr.onerror = fail
    xhr.ontimeout = fail
    xhr.onabort = fail
    xhr.onload = () => {
      clearInterval(waiting)
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(failed())
        return
      }
      const timeline = (xhr.response as { timeline?: VerseTimelineEntry[] } | null)?.timeline
      report(1)
      resolve(Array.isArray(timeline) && timeline.length > 0 ? timeline : null)
    }
    xhr.send(form)
  })
}
