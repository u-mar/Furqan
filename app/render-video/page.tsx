'use client'

import { useEffect, useState } from 'react'
import { setAppSettings } from '@/lib/app-settings'
import { makeRecitationVideo } from '@/lib/qari-share-media'
import type { Recitation } from '@/lib/qari'
import { cloudVideoFor } from '@/lib/qari-video-made-for'
import { DEFAULT_TRANSLATION_EDITION } from '@/lib/translations'

/**
 * Not a screen people see: the page the cloud opens in a headless browser to make a recitation's
 * share video ahead of time (services/nadir-asr/video.py). It makes the video with exactly the code
 * a phone uses, so the result looks the same, in English with the ayah and its translation, on the
 * recitation's own background, at the cloud's own full-HD (1080p) quality (re-encoded smaller afterwards).
 *
 * /render-video?id=<recitation id>. The finished file waits in window.__nabaVideo for the browser's
 * controller to read; window.__nabaVideoState says how far it is ("working", "done" or an error).
 */
declare global {
  interface Window {
    __nabaVideo?: Blob
    __nabaVideoState?: string
    __nabaVideoProgress?: number
    /** What the video was made for (lib/qari-video-made-for), passed back so an out-of-date one is not kept. */
    __nabaVideoMadeFor?: string
  }
}

export default function RenderVideoPage() {
  const [state, setState] = useState('starting')

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('id') ?? ''
    const report = (next: string) => {
      window.__nabaVideoState = next
      setState(next)
    }
    void (async () => {
      try {
        // English, the ayah with its translation: the one version made ahead of time.
        setAppSettings({ language: 'en', translationLanguage: 'en', translationEditionId: DEFAULT_TRANSLATION_EDITION.en })
        try {
          localStorage.removeItem('muyassar_qari_text_mode')
        } catch {
          // Then it is "both" anyway.
        }
        const res = await fetch(`/api/qari/${encodeURIComponent(id)}`, { cache: 'no-store' })
        if (!res.ok) throw new Error(`recitation ${res.status}`)
        const { recitation } = (await res.json()) as { recitation: Recitation }
        if (recitation.kind === 'ayah') throw new Error('an ayah card has no video')
        window.__nabaVideoMadeFor = cloudVideoFor(recitation)
        report('working')
        const media = await makeRecitationVideo(
          recitation,
          (fraction) => {
            window.__nabaVideoProgress = fraction
          },
          undefined,
          { backgroundId: recitation.background || 'black', mix: false, quality: 'master' }
        )
        window.__nabaVideo = media.blob
        report('done')
      } catch (err) {
        report(`error: ${err instanceof Error ? err.message : String(err)}`)
      }
    })()
  }, [])

  return <p style={{ color: '#fff', padding: 16, fontFamily: 'system-ui' }}>{state}</p>
}
