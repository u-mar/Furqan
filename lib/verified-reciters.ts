'use client'

import { useEffect, useState } from 'react'
import type { ListenQarisResponse, PublicListenQari } from '@/lib/listen-qaris'
import { getLocalReciters, onLocalRecitersChange, setLocalReciters, type QiraatId, type RecitationStyle, type Reciter } from '@/lib/reciters'

/**
 * The verified qaris the admin has added to Listen, on the phone: fetched from the server and kept,
 * so a saved choice of one of them, and their downloaded surahs, still work offline and from the
 * very first moment the app opens (before the list has come again).
 */

const STORAGE_KEY = 'naba_local_reciters_v1'
/** How long the list on the phone is trusted before it is asked for again. */
const FRESH_MS = 2 * 60 * 1000

const ACCENTS: Array<[string, string]> = [
  ['#47c6d4', '#2a8fa0'],
  ['#63d1a8', '#2f9e75'],
  ['#f0c877', '#d29a3c'],
  ['#7d8cf0', '#4756c4'],
  ['#d9c08a', '#b0914f'],
]

function accentFor(id: string): [string, string] {
  let hash = 0
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return ACCENTS[hash % ACCENTS.length]
}

export function toReciter(q: PublicListenQari): Reciter {
  const surahUrls: Record<number, string> = {}
  for (const [n, url] of Object.entries(q.surahs)) surahUrls[Number(n)] = url
  return {
    id: q.id,
    name: q.name,
    nameAr: q.nameAr,
    source: 'mp3quran',
    folder: '',
    mp3quranBase: '',
    surahUrls,
    surahs: Object.keys(surahUrls).map(Number).sort((a, b) => a - b),
    qiraat: q.qiraat as QiraatId,
    style: q.style as RecitationStyle,
    accent: accentFor(q.id),
    photoUrl: q.photoUrl,
    country: q.country,
    city: q.city,
    username: q.username,
    local: true,
  }
}

interface Saved {
  at: number
  data: ListenQarisResponse
}

let viewerCountry: string | undefined
let savedAt = 0
let pending: Promise<void> | null = null

function apply(data: ListenQarisResponse): void {
  if (data.country) viewerCountry = data.country
  setLocalReciters(data.reciters.map(toReciter))
}

// The list kept from last time, at once: a verified qari chosen before is known before anything renders.
if (typeof window !== 'undefined') {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Saved | null
    if (saved?.data && Array.isArray(saved.data.reciters)) {
      savedAt = saved.at
      apply(saved.data)
    }
  } catch {
    // Nothing kept, or unreadable: the list comes from the server.
  }
}

/** Asks the server for the list again, unless it came only a few minutes ago. */
export function refreshLocalReciters(force = false): Promise<void> {
  if (!force && Date.now() - savedAt < FRESH_MS) return Promise.resolve()
  if (pending) return pending
  pending = fetch('/api/listen/reciters', { cache: 'no-store' })
    .then(async (res) => {
      if (!res.ok) return
      const data = (await res.json()) as ListenQarisResponse
      if (!Array.isArray(data.reciters)) return
      savedAt = Date.now()
      apply(data)
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ at: savedAt, data } satisfies Saved))
      } catch {
        // Full storage: the list still works until the app closes.
      }
    })
    .catch(() => {})
    .finally(() => {
      pending = null
    })
  return pending
}

/** The viewer's country (two letters), as their connection showed it the last time the list came. */
export function getViewerCountry(): string | undefined {
  return viewerCountry
}

/** The verified qaris, kept up to date: asks for the list when first used. */
export function useLocalReciters(): { reciters: Reciter[]; country: string | undefined } {
  const [state, setState] = useState(() => ({ reciters: getLocalReciters(), country: viewerCountry }))
  useEffect(() => {
    const update = () => setState({ reciters: getLocalReciters(), country: viewerCountry })
    const stop = onLocalRecitersChange(update)
    update()
    void refreshLocalReciters()
    return stop
  }, [])
  return state
}
