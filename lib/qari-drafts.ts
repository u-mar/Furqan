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
  /** Ayat marked while reading from the Mushaf, oldest first. Empty otherwise. */
  verseTimeline: { verseKey: string; atSeconds: number }[]
  /** The background chosen for it — an id from lib/qari-backgrounds. Missing on drafts from before. */
  background?: string
  /** A file made outside the app rather than a take recorded here. */
  fromFile?: boolean
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

/**
 * The recording itself — saved the moment a take is ready, before anything
 * else is even filled in. `fresh` is a new take: it starts from `fields` (read
 * once the audio is stored, so nothing chosen meanwhile is lost) rather than
 * keeping the details of the draft it replaces.
 */
export async function saveDraftAudio(
  blob: Blob,
  mimeType: string,
  durationSec: number,
  { fresh = false, fields }: { fresh?: boolean; fields?: () => Partial<QariDraftMeta> } = {}
): Promise<void> {
  if (typeof caches === 'undefined') return
  try {
    const cache = await caches.open(DRAFT_CACHE)
    await cache.put(DRAFT_AUDIO_URL, new Response(blob, { headers: { 'Content-Type': mimeType } }))
    const existing = fresh ? null : readMeta()
    writeMeta({
      title: existing?.title ?? '',
      hashtags: existing?.hashtags ?? '',
      caption: existing?.caption ?? '',
      isPrivate: existing?.isPrivate ?? false,
      imitating: existing?.imitating ?? null,
      space: existing?.space ?? 'reciter',
      peaks: existing?.peaks ?? [],
      verseTimeline: existing?.verseTimeline ?? [],
      background: existing?.background,
      ...fields?.(),
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

/* ------------------------------------------------------------------ the shelf */

/*
 * Drafts kept for later, as many as the person likes: "Save to drafts" moves the
 * working draft above onto this shelf, and opening one from the profile moves it
 * back to be finished (whatever was being worked on changes places with it, so
 * nothing is lost). Each one's audio sits beside the working draft's in Cache
 * Storage; their details are one list in localStorage.
 */

const SHELF_KEY = 'naba_qari_drafts'
const DRAFTS_EVENT = 'naba-qari-drafts'

export interface ShelvedDraft extends QariDraftMeta {
  id: string
}

const shelfAudioUrl = (id: string) => `/__qari-draft-audio__/${id}`

export function listDrafts(): ShelvedDraft[] {
  if (typeof window === 'undefined') return []
  try {
    const list = JSON.parse(localStorage.getItem(SHELF_KEY) || '[]') as ShelvedDraft[]
    return Array.isArray(list) ? list.filter((d) => d && typeof d.id === 'string') : []
  } catch {
    return []
  }
}

function writeShelf(list: ShelvedDraft[]): void {
  try {
    localStorage.setItem(SHELF_KEY, JSON.stringify(list))
  } catch {
    // Kept only as far as the phone allows.
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(DRAFTS_EVENT))
}

/** Told when a draft is saved, opened or deleted, for whatever lists them. */
export function subscribeDrafts(listener: () => void): () => void {
  window.addEventListener(DRAFTS_EVENT, listener)
  window.addEventListener('storage', listener)
  return () => {
    window.removeEventListener(DRAFTS_EVENT, listener)
    window.removeEventListener('storage', listener)
  }
}

/** The working draft, put on the shelf for later. False when there was none, or it could not be kept. */
export async function shelveDraft(): Promise<boolean> {
  const meta = readMeta()
  if (!meta || typeof caches === 'undefined') return false
  try {
    const cache = await caches.open(DRAFT_CACHE)
    const audio = await cache.match(DRAFT_AUDIO_URL)
    if (!audio) return false
    const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
    await cache.put(shelfAudioUrl(id), audio)
    writeShelf([{ ...meta, id, savedAt: Date.now() }, ...listDrafts()])
    await clearDraft()
    return true
  } catch {
    return false
  }
}

/** A shelved draft made the working one, to be finished on the record screen. */
export async function openDraft(id: string): Promise<boolean> {
  const chosen = listDrafts().find((d) => d.id === id)
  if (!chosen || typeof caches === 'undefined') return false
  try {
    const cache = await caches.open(DRAFT_CACHE)
    const audio = await cache.match(shelfAudioUrl(id))
    if (!audio) {
      writeShelf(listDrafts().filter((d) => d.id !== id))
      return false
    }
    const blob = await audio.blob()
    // Whatever was being worked on goes onto the shelf in its place.
    await shelveDraft()
    await cache.put(DRAFT_AUDIO_URL, new Response(blob, { headers: { 'Content-Type': chosen.mimeType } }))
    const { id: _id, ...meta } = chosen
    void _id
    writeMeta(meta)
    await cache.delete(shelfAudioUrl(id))
    writeShelf(listDrafts().filter((d) => d.id !== id))
    return true
  } catch {
    return false
  }
}

export async function deleteDraft(id: string): Promise<void> {
  writeShelf(listDrafts().filter((d) => d.id !== id))
  try {
    if (typeof caches !== 'undefined') await (await caches.open(DRAFT_CACHE)).delete(shelfAudioUrl(id))
  } catch {
    // Its entry is gone either way.
  }
}
