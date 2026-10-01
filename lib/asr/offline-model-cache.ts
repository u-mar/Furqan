/**
 * The offline Quran speech model (Muno459/fastconformer-quran, ONNX) on the
 * phone, for marking which ayat a Qari recitation holds. Kept in Cache
 * Storage under its own name — apart from the streaming model the Hifdh Test
 * used, which the app deletes — and read back only when a recording is
 * analysed.
 *
 * It comes from one of two places: a download from MODEL_URL (a file served by
 * the app, or a bucket of yours — NEXT_PUBLIC_QARI_ASR_MODEL_URL), or a file
 * chosen on the phone, which needs no hosting at all.
 *
 * Use an int8 or fp32 export: the in-browser runtime has no fp16 kernels.
 * (services/nadir-asr/quantize.py makes the int8 one, about 110 MB.)
 */

import { tr } from '@/lib/i18n-core'

export const QARI_ASR_CACHE = 'muyassar-qari-asr-v1'
const MODEL_KEY = '/models/asr/qari-offline.onnx'
const FLAG_KEY = 'muyassar_qari_asr_model'

export const QARI_ASR_MODEL_URL = process.env.NEXT_PUBLIC_QARI_ASR_MODEL_URL || '/models/asr/qari-offline.onnx'

export interface ModelProgress {
  percent: number
  label: string
}

export function isQariAsrModelReady(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(FLAG_KEY) === '1'
  } catch {
    return false
  }
}

function setReady(ready: boolean) {
  try {
    if (ready) localStorage.setItem(FLAG_KEY, '1')
    else localStorage.removeItem(FLAG_KEY)
    window.dispatchEvent(new Event('qari-asr-model-changed'))
  } catch {
    /* ignore */
  }
}

function requireCaches() {
  if (typeof caches === 'undefined') throw new Error(tr('Downloading is not supported in this browser.'))
}

/** Streams the file into Cache Storage without holding it all in memory, reporting progress. */
export async function downloadQariAsrModel(onProgress?: (p: ModelProgress) => void, url = QARI_ASR_MODEL_URL): Promise<void> {
  requireCaches()
  const report = (percent: number, label: string) => onProgress?.({ percent, label })
  report(0, tr('Starting…'))

  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) throw new Error(tr('Download failed ({status})', { status: response.status }))
  // A page that comes back instead of a model (a missing file served as a web page) is not a model.
  if ((response.headers.get('content-type') || '').includes('text/html')) {
    throw new Error(tr('The model file was not found at that address.'))
  }

  const total = Number(response.headers.get('content-length') || 0)
  let received = 0
  const counted =
    response.body && total > 0
      ? response.body.pipeThrough(
          new TransformStream<Uint8Array, Uint8Array>({
            transform(chunk, controller) {
              received += chunk.length
              report(Math.min(99, Math.round((received / total) * 100)), tr('Downloading the recitation model…'))
              controller.enqueue(chunk)
            },
          })
        )
      : response.body

  const cache = await caches.open(QARI_ASR_CACHE)
  await cache.put(MODEL_KEY, new Response(counted, { headers: { 'Content-Type': 'application/octet-stream' } }))
  setReady(true)
  report(100, tr('Ready — works offline'))
}

/** Saves a model file chosen on the phone. */
export async function saveQariAsrModelFile(file: File): Promise<void> {
  requireCaches()
  if (file.size < 1_000_000) throw new Error(tr('That does not look like the model file.'))
  const cache = await caches.open(QARI_ASR_CACHE)
  await cache.put(MODEL_KEY, new Response(file, { headers: { 'Content-Type': 'application/octet-stream' } }))
  setReady(true)
}

export async function getQariAsrModelBytes(): Promise<Uint8Array> {
  const cache = await caches.open(QARI_ASR_CACHE)
  const hit = await cache.match(MODEL_KEY)
  if (!hit) {
    setReady(false)
    throw new Error(tr('The recitation model is not downloaded.'))
  }
  return new Uint8Array(await hit.arrayBuffer())
}

export async function removeQariAsrModel(): Promise<void> {
  setReady(false)
  if (typeof caches !== 'undefined') await caches.delete(QARI_ASR_CACHE)
}

/** Re-renders whatever shows the model's state when it is saved or removed. */
export function onQariAsrModelChange(listener: () => void): () => void {
  window.addEventListener('qari-asr-model-changed', listener)
  return () => window.removeEventListener('qari-asr-model-changed', listener)
}
