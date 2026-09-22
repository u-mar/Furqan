'use client'

/**
 * The one recitation being reviewed but not yet published, kept on the phone
 * so backing out — a swipe back, closing the tab, losing the connection —
 * never throws away a finished take. Only one at a time: starting a fresh
 * take (Record again) or publishing replaces or clears it.
 *
 * The audio itself lives in Cache Storage, the same place offline surahs are
 * kept (see lib/offline-audio.ts) — it's the one client-side store in this
 * app built for holding a Blob. The details around it (title, hashtags…)
 * are small enough for localStorage.
 */

const DRAFT_CACHE = 'muyassar-qari-draft-v1'
const DRAFT_AUDIO_URL = '/__qari-draft-audio__'
const DRAFT_META_KEY = 'muyassar_qari_draft'

export interface QariDraftMeta {
  title: string
  hashtags: string
  caption: string
  isPrivate: boolean
  imitating: string | null
  space: string
  mimeType: string
  durationSec: number
  peaks: number[]
  savedAt: number
}

export interface QariDraft extends QariDraftMeta {
  blob: Blob
}

function readMeta(): QariDraftMeta | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(DRAFT_META_KEY)
    return raw ? (JSON.parse(raw) as QariDraftMeta) : null
  } catch {
    return null
  }
}

function writeMeta(meta: QariDraftMeta): void {
  try {
    localStorage.setItem(DRAFT_META_KEY, JSON.stringify(meta))
  } catch {
    // A draft is a nicety, not a promise.
  }
}

/** The recording itself — saved the moment a take is ready, before anything else is even filled in. */
export async function saveDraftAudio(blob: Blob, mimeType: string, durationSec: number): Promise<void> {
  if (typeof caches === 'undefined') return
  try {
    const cache = await caches.open(DRAFT_CACHE)
    await cache.put(DRAFT_AUDIO_URL, new Response(blob, { headers: { 'Content-Type': mimeType } }))
    const existing = readMeta()
    writeMeta({
      title: existing?.title ?? '',
      hashtags: existing?.hashtags ?? '',
      caption: existing?.caption ?? '',
      isPrivate: existing?.isPrivate ?? false,
      imitating: existing?.imitating ?? null,
      space: existing?.space ?? 'reciter',
      peaks: existing?.peaks ?? [],
      mimeType,
      durationSec,
      savedAt: Date.now(),
    })
  } catch {
    // Best effort — losing the draft is no worse than not having this at all.
  }
}

/** What's been typed while reviewing — merged into whatever's already saved, so it can't outrun the audio save above. */
export function saveDraftMeta(patch: Partial<Omit<QariDraftMeta, 'mimeType' | 'durationSec'>>): void {
  const existing = readMeta()
  if (!existing) return
  writeMeta({ ...existing, ...patch, savedAt: Date.now() })
}

/** A cheap check — no Cache Storage read — for whether there's a draft to offer. */
export function peekDraftMeta(): QariDraftMeta | null {
  return readMeta()
}

export async function loadDraft(): Promise<QariDraft | null> {
  const meta = readMeta()
  if (!meta || typeof caches === 'undefined') return null
  try {
    const cache = await caches.open(DRAFT_CACHE)
    const hit = await cache.match(DRAFT_AUDIO_URL)
    if (!hit) return null
    const blob = await hit.blob()
    if (!blob.size) return null
    return { ...meta, blob }
  } catch {
    return null
  }
}

export async function clearDraft(): Promise<void> {
  try {
    localStorage.removeItem(DRAFT_META_KEY)
  } catch {
    // Best effort.
  }
  try {
    if (typeof caches !== 'undefined') {
      const cache = await caches.open(DRAFT_CACHE)
      await cache.delete(DRAFT_AUDIO_URL)
    }
  } catch {
    // Best effort.
  }
}
