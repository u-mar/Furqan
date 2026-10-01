'use client'

import { useSyncExternalStore } from 'react'
import { rememberRecitationBackground } from '@/lib/qari-backgrounds'
import { clearDraft } from '@/lib/qari-drafts'
import {
  primeRecitationAudio,
  publishAyahCard,
  publishRecitation,
  tidyHashtags,
  type AyahCardInput,
  type PublishInput,
  type Recitation,
} from '@/lib/qari'
import { tr } from '@/lib/i18n-core'
import { toast } from '@/lib/toast'

/**
 * Posts on their way to Qari — recitations from the record screen and ayah
 * cards from the Read screen's share page. Posting hands the post over and
 * moves on, like TikTok: the upload carries on here, outside any one screen,
 * and the profile shows how far along it is.
 *
 *   uploading  → going up (progress 0–1)
 *   processing → all of it has arrived and the server is saving it. When the
 *                ayah-marking model is added, it runs in this stage too.
 *   done       → posted; `recitation` is how it now appears on the profile
 *   failed     → kept, with the reason, until it is tried again or dropped
 */

export type UploadStage = 'uploading' | 'processing' | 'done' | 'failed'

export interface QariUpload {
  /** A local id — the server's is only known once it is done. */
  key: string
  title: string
  /** What its card shows while it goes up: the chosen background, or the ayah card itself. */
  cover: { background: string } | { image: string }
  isPrivate: boolean
  userUsername: string
  stage: UploadStage
  progress: number
  error: string | null
  recitation: Recitation | null
}

interface Job {
  send: (onProgress: (fraction: number) => void) => Promise<string>
  /** How it appears on the profile once it has its id. */
  posted: (id: string) => Recitation
  afterPosted: (id: string) => void
  doneMessage: string
}

let uploads: QariUpload[] = []
const jobs = new Map<string, Job>()
const listeners = new Set<() => void>()
const NONE: QariUpload[] = []

function emit() {
  for (const listener of listeners) listener()
}

function patch(key: string, changes: Partial<QariUpload>) {
  uploads = uploads.map((u) => (u.key === key ? { ...u, ...changes } : u))
  emit()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const sending = () => uploads.some((u) => u.stage === 'uploading' || u.stage === 'processing')

/** Leaving the app while something is still going up would lose it, so the browser asks first. */
function guardUnload(event: BeforeUnloadEvent) {
  if (!sending()) return
  event.preventDefault()
  event.returnValue = ''
}

async function run(key: string) {
  const job = jobs.get(key)
  if (!job) return
  patch(key, { stage: 'uploading', progress: 0, error: null })
  window.addEventListener('beforeunload', guardUnload)

  let shownAt = 0
  try {
    const id = await job.send((fraction) => {
      // Enough to move the number smoothly without re-drawing on every packet.
      const now = performance.now()
      if (fraction < 1 && now - shownAt < 100) return
      shownAt = now
      patch(key, { progress: fraction, stage: fraction >= 1 ? 'processing' : 'uploading' })
    })
    job.afterPosted(id)
    patch(key, { stage: 'done', progress: 1, recitation: job.posted(id) })
    toast(job.doneMessage, 'success')
  } catch (err) {
    patch(key, { stage: 'failed', error: err instanceof Error ? err.message : tr('Could not publish.') })
    toast(tr('Your post did not go up. Open your profile to try again.'), 'error')
  } finally {
    if (!sending()) window.removeEventListener('beforeunload', guardUnload)
  }
}

function start(upload: Omit<QariUpload, 'key' | 'stage' | 'progress' | 'error' | 'recitation'>, job: Job): string {
  const key = `upload-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
  jobs.set(key, job)
  uploads = [{ ...upload, key, stage: 'uploading', progress: 0, error: null, recitation: null }, ...uploads]
  emit()
  void run(key)
  return key
}

/** Starts posting a recitation and returns at once; follow it with useUploads. */
export function postRecitation(input: PublishInput): string {
  return start(
    {
      title: input.title,
      cover: { background: input.background },
      isPrivate: input.isPrivate,
      userUsername: input.userUsername,
    },
    {
      send: (onProgress) => publishRecitation(input, onProgress),
      afterPosted: (id) => {
        primeRecitationAudio(id, input.blob)
        rememberRecitationBackground(input.background)
        void clearDraft()
      },
      posted: (id) => ({
        id,
        kind: 'recitation',
        verseKey: null,
        imageUrl: null,
        userName: input.userName,
        userUsername: input.userUsername,
        title: input.title,
        space: input.space,
        hashtags: tidyHashtags(input.hashtags),
        isPrivate: input.isPrivate,
        imitating: input.imitating || null,
        peaks: input.peaks,
        verseTimeline: input.verseTimeline,
        background: input.background,
        caption: input.caption,
        durationSec: input.durationSec,
        likeCount: 0,
        playCount: 0,
        createdAt: new Date().toISOString(),
        liked: false,
      }),
      doneMessage: input.isPrivate ? tr('Saved to your profile.') : tr('Your recitation is posted.'),
    }
  )
}

/** Starts posting an ayah card from the Read screen; follow it with useUploads. */
export function postAyahCard(input: AyahCardInput): string {
  // Shown on its card while it goes up; let go of once the upload is dropped.
  const preview = URL.createObjectURL(input.image)
  const key = start(
    {
      title: input.title,
      cover: { image: preview },
      isPrivate: input.isPrivate,
      userUsername: input.userUsername,
    },
    {
      send: (onProgress) => publishAyahCard(input, onProgress),
      afterPosted: () => {},
      posted: (id) => ({
        id,
        kind: 'ayah',
        verseKey: input.verseKey,
        imageUrl: `/api/qari/image/${id}`,
        userName: input.userName,
        userUsername: input.userUsername,
        title: input.title,
        space: 'clean',
        hashtags: tidyHashtags(input.hashtags),
        isPrivate: input.isPrivate,
        imitating: null,
        peaks: [],
        verseTimeline: [],
        background: null,
        caption: input.caption,
        durationSec: 0,
        likeCount: 0,
        playCount: 0,
        createdAt: new Date().toISOString(),
        liked: false,
      }),
      doneMessage: input.isPrivate ? tr('Saved to your profile.') : tr('Posted to Qari.'),
    }
  )
  previews.set(key, preview)
  return key
}

const previews = new Map<string, string>()

export function retryUpload(key: string): void {
  void run(key)
}

/** Forgets an upload: once a finished one is on the profile, or when a failed one is let go. */
export function dismissUpload(key: string): void {
  uploads = uploads.filter((u) => u.key !== key)
  jobs.delete(key)
  const preview = previews.get(key)
  if (preview) {
    URL.revokeObjectURL(preview)
    previews.delete(key)
  }
  emit()
}

/** Everything being posted (or just posted, or failed) in this visit. */
export function useUploads(): QariUpload[] {
  return useSyncExternalStore(subscribe, () => uploads, () => NONE)
}
