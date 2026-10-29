'use client'

import { useEffect } from 'react'
import { hasNativePlugin, nativePlugin } from '@/lib/native-app'

interface NabaShare {
  write: (options: { name: string; data: string; append: boolean }) => Promise<void>
  share: (options: { name?: string; mime?: string; title?: string; text?: string }) => Promise<void>
  save: (options: { name: string; mime: string }) => Promise<void>
}

/** Bytes per trip over the bridge, which carries text: a long video goes over in pieces. */
const PIECE = 512 * 1024

const MIME_BY_EXTENSION: Record<string, string> = {
  mp4: 'video/mp4',
  webm: 'video/webm',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  m4a: 'audio/mp4',
  mp3: 'audio/mpeg',
  ogg: 'audio/ogg',
}

function mimeOf(blob: Blob, name: string): string {
  return blob.type || MIME_BY_EXTENSION[name.split('.').pop()?.toLowerCase() ?? ''] || 'application/octet-stream'
}

function base64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const url = String(reader.result)
      resolve(url.slice(url.indexOf(',') + 1))
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

async function handOver(plugin: NabaShare, blob: Blob, name: string): Promise<void> {
  let at = 0
  do {
    await plugin.write({ name, data: await base64(blob.slice(at, at + PIECE)), append: at > 0 })
    at += PIECE
  } while (at < blob.size)
}

/**
 * In the Play Store app, gives every share and save button on the site the
 * phone's own share sheet and gallery (android/…/NabaSharePlugin.java), which
 * Android's WebView lacks: `navigator.share` (files, text and links) is filled
 * in, and a tap on a download link (a made video, a verse picture) saves the
 * file into the gallery's "Naba" folder instead of going nowhere. The buttons
 * themselves stay as they are on the website. On the website it does nothing.
 */
export default function NativeShare() {
  useEffect(() => {
    if (!hasNativePlugin('NabaShare')) return

    const share = async (data: ShareData = {}) => {
      const { plugin } = await nativePlugin<NabaShare>('NabaShare')
      const link = data.url && !data.text?.includes(data.url) ? data.url : null
      const text = [data.text, link].filter(Boolean).join('\n') || undefined
      const file = data.files?.[0]
      if (!file) return plugin.share({ title: data.title, text })
      await handOver(plugin, file, file.name)
      await plugin.share({ name: file.name, mime: mimeOf(file, file.name), title: data.title, text })
    }
    // One file at a time, as the plugin takes; text and links always.
    const canShare = (data: ShareData = {}) => (data.files?.length ?? 0) <= 1

    const before = { share: navigator.share, canShare: navigator.canShare }
    Object.defineProperty(navigator, 'share', { value: share, configurable: true, writable: true })
    Object.defineProperty(navigator, 'canShare', { value: canShare, configurable: true, writable: true })

    // The site saves a file by clicking a download link it made for it; catch
    // that click on its way down, before the WebView drops it.
    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest?.('a[download]')
      if (!(link instanceof HTMLAnchorElement) || !/^(blob|data):/.test(link.href)) return
      event.preventDefault()
      const name = link.download || 'naba'
      // Read straight away: the site lets go of the file soon after the click.
      const file = fetch(link.href).then((res) => res.blob())
      void (async () => {
        const { plugin } = await nativePlugin<NabaShare>('NabaShare')
        const blob = await file
        await handOver(plugin, blob, name)
        await plugin.save({ name, mime: mimeOf(blob, name) })
      })().catch(() => {})
    }
    document.addEventListener('click', onClick, true)

    return () => {
      document.removeEventListener('click', onClick, true)
      Object.defineProperty(navigator, 'share', { value: before.share, configurable: true, writable: true })
      Object.defineProperty(navigator, 'canShare', { value: before.canShare, configurable: true, writable: true })
    }
  }, [])

  return null
}
