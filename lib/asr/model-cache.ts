/**
 * Downloads the Quran speech-recognition ONNX model (~130MB) into Cache
 * Storage, mirroring `lib/offline-translations.ts`'s download-once-then-
 * offline pattern. Hosted in the same R2 "recitations" bucket used for
 * Hassan Al-Wajdi's audio (see lib/reciters.ts) rather than committed to
 * git — GitHub Releases was tried first but doesn't send CORS headers, so a
 * browser `fetch()` (needed for the progress bar and to read the bytes into
 * onnxruntime-web) gets blocked outright; this bucket already has a CORS
 * rule allowing GET, proven working for the reciter-audio offline downloads.
 * Everything else the ASR pipeline needs — the CMVN/tokenizer JSON and the
 * onnxruntime-web WASM runtime — is small enough to ship as normal static
 * files under `public/`, no download step needed.
 */

import { tr } from '@/lib/i18n-core'

const CACHE_NAME = 'muyassar-asr-model-v1'
const FLAG_KEY = 'muyassar_asr_model_cached'
const MODEL_URL = 'https://pub-0d4d974a9cad4a92b81667e5b4f5523f.r2.dev/model.q8.onnx'

export const ASR_MODEL_CACHE_KEY = '/models/asr/model.q8.onnx'

export interface AsrModelDownloadProgress {
  percent: number
  label: string
}

export function isAsrModelDownloaded(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(FLAG_KEY) === '1'
  } catch {
    return false
  }
}

export function clearAsrModelDownloadedFlag(): void {
  try {
    localStorage.removeItem(FLAG_KEY)
  } catch {
    /* ignore */
  }
}

/** Downloads the model into Cache Storage, reporting byte progress. Safe to
 *  call again after a failed attempt. */
export async function downloadAsrModel(onProgress?: (p: AsrModelDownloadProgress) => void): Promise<void> {
  if (typeof caches === 'undefined') {
    throw new Error(tr('Downloading is not supported in this browser.'))
  }
  const report = (percent: number, label: string) => onProgress?.({ percent, label })
  report(0, tr('Starting…'))

  const response = await fetch(MODEL_URL, { cache: 'no-store' })
  if (!response.ok) throw new Error(tr('Download failed ({status})', { status: response.status }))

  const total = Number(response.headers.get('content-length') || 0)
  const body = response.body

  let toStore: Response
  if (body && total > 0) {
    const reader = body.getReader()
    const parts: Uint8Array[] = []
    let received = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value?.length) continue
      parts.push(value)
      received += value.length
      report(Math.min(99, Math.round((received / total) * 100)), tr('Downloading speech recognition model…'))
    }
    const merged = new Uint8Array(received)
    let offset = 0
    for (const part of parts) {
      merged.set(part, offset)
      offset += part.length
    }
    toStore = new Response(merged, { headers: response.headers })
  } else {
    report(10, tr('Downloading speech recognition model…'))
    toStore = response
  }

  const cache = await caches.open(CACHE_NAME)
  await cache.put(ASR_MODEL_CACHE_KEY, toStore)

  try {
    localStorage.setItem(FLAG_KEY, '1')
  } catch {
    /* ignore */
  }
  report(100, tr('Ready — works offline'))
}

export async function getCachedAsrModelBytes(): Promise<ArrayBuffer> {
  const cache = await caches.open(CACHE_NAME)
  const hit = await cache.match(ASR_MODEL_CACHE_KEY)
  if (!hit) throw new Error('ASR model not downloaded')
  return hit.arrayBuffer()
}

export function clearAsrModelCache(): Promise<void> {
  clearAsrModelDownloadedFlag()
  return caches.delete(CACHE_NAME).then(() => undefined)
}
