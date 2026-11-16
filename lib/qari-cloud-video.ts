import { createHash, timingSafeEqual } from 'crypto'
import type { Recitation as RecitationRecord } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { r2Delete } from '@/lib/r2'

/**
 * The English share video made ahead of time in the cloud (services/nadir-asr/video_modal.py), so
 * "Save video" in English downloads a ready, small file instead of the phone making a big one.
 *
 * The cloud opens app/render-video, makes the video with the app's own maker, re-encodes it smaller,
 * stores it in R2 under videos/en/, and reports back to /api/qari/[id]/video. A video is made when a
 * public recitation is published, and again when what it shows changes (its background, or its
 * title when it has no ayah marks and so shows the title instead).
 *
 * Env: VIDEO_RENDER_URL (the cloud's "start" link) and ASR_API_KEY (the key both sides share).
 */

export { cloudVideoFor } from '@/lib/qari-video-made-for'

export const CLOUD_VIDEO_KEY_RE = /^videos\/en\/[a-f0-9]{24}-[a-z0-9]{4,16}\.mp4$/

/** Asks the cloud to make (or make again) this recitation's video. Never throws. */
export async function requestCloudVideo(id: string): Promise<void> {
  const url = process.env.VIDEO_RENDER_URL?.trim()
  const key = process.env.ASR_API_KEY?.trim()
  if (!url || !key) return
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key },
      body: JSON.stringify({ id }),
      signal: AbortSignal.timeout(20_000),
    })
    if (!res.ok) console.warn('[qari] cloud video not started:', res.status)
  } catch (err) {
    console.warn('[qari] cloud video not started:', err instanceof Error ? err.message : err)
  }
}

/** Forgets a recitation's video (its file too), when it no longer matches or the recitation goes. */
export async function dropCloudVideo(r: Pick<RecitationRecord, 'id' | 'videoKey'>, keepRecord = false): Promise<void> {
  if (!r.videoKey) return
  await r2Delete(r.videoKey).catch(() => {})
  if (!keepRecord) await prisma.recitation.update({ where: { id: r.id }, data: { videoKey: null } }).catch(() => {})
}

/** Whether a request carries the shared key. */
export function hasServiceKey(given: string | null): boolean {
  const expected = process.env.ASR_API_KEY?.trim()
  if (!expected || !given) return false
  const digest = (s: string) => createHash('sha256').update(s).digest()
  return timingSafeEqual(digest(given), digest(expected))
}
