'use client'

import { useEffect, useState } from 'react'
import { APP_NAME } from '@/lib/app-brand'
import { cn } from '@/lib/cn'
import { loadPageFont, qcfPageFontFamily } from '@/lib/mushaf-fonts'
import { getVerseByKey } from '@/lib/quran'

const SHOWN_KEY = 'nadir-splash-shown'
const SHOW_MS = 1200
const FADE_MS = 500
const INK = '#f5ecd8'

/** أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ — the last five words of 13:28 (page 252). */
const VERSE_KEY = '13:28'
const WORD_POSITIONS = [7, 8, 9, 10, 11]
const FALLBACK_TEXT = 'أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ'

/**
 * A brief branded cover shown once per app open, over the manifest's own
 * black background — the OS-generated PWA splash can only show the icon, so
 * this is what carries the verse. Rendered in the mushaf's own QCF glyph
 * font once it loads (same script the reader uses), falling back to Amiri
 * until then or if it never does.
 */
export default function SplashScreen() {
  const [phase, setPhase] = useState<'visible' | 'fading' | 'hidden'>('visible')
  const [qcf, setQcf] = useState<{ words: string[]; fontFamily: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const verse = await getVerseByKey(VERSE_KEY)
        const words = WORD_POSITIONS.map(
          (pos) => verse.words?.find((w) => w.position === pos)?.code_v2?.trim() || ''
        )
        if (words.some((w) => !w)) return
        const page = verse.words?.find((w) => w.position === WORD_POSITIONS[0])?.v2_page || 0
        if (!page) return
        const ok = await loadPageFont(page, words.join('').slice(0, 12))
        if (!cancelled && ok) setQcf({ words, fontFamily: qcfPageFontFamily(page) })
      } catch {
        // Amiri fallback below is a perfectly good verse rendering on its own.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    try {
      if (sessionStorage.getItem(SHOWN_KEY) === '1') {
        setPhase('hidden')
        return
      }
      sessionStorage.setItem(SHOWN_KEY, '1')
    } catch {
      /* private mode — just show it once, no persistence needed */
    }
    const fadeTimer = setTimeout(() => setPhase('fading'), SHOW_MS)
    const hideTimer = setTimeout(() => setPhase('hidden'), SHOW_MS + FADE_MS)
    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(hideTimer)
    }
  }, [])

  if (phase === 'hidden') return null

  return (
    <div
      aria-hidden
      className={cn(
        'fixed inset-0 z-[300] flex flex-col items-center bg-black px-10 transition-opacity ease-out',
        phase === 'fading' ? 'pointer-events-none opacity-0' : 'opacity-100'
      )}
      style={{
        transitionDuration: `${FADE_MS}ms`,
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'max(2.25rem, env(safe-area-inset-bottom) + 1.25rem)',
      }}
    >
      <div className="flex flex-1 items-center justify-center">
        <p
          dir="rtl"
          lang="ar"
          className="mx-auto max-w-sm text-center"
          style={
            qcf
              ? {
                  fontFamily: `"${qcf.fontFamily}", var(--font-amiri), Amiri, serif`,
                  fontSize: 'clamp(36px, 10vw, 52px)',
                  lineHeight: 2,
                  color: INK,
                  textShadow: '0 0 28px rgba(245, 236, 216, 0.22)',
                }
              : {
                  fontFamily: 'var(--font-amiri), Amiri, serif',
                  fontWeight: 700,
                  fontSize: 'clamp(32px, 8.5vw, 44px)',
                  lineHeight: 2.05,
                  color: INK,
                  textShadow: '0 0 28px rgba(245, 236, 216, 0.22)',
                }
          }
        >
          {qcf ? qcf.words.join(' ') : FALLBACK_TEXT}
        </p>
      </div>

      <span
        style={{
          fontFamily: 'var(--font-home-serif), Fraunces, Georgia, serif',
          fontWeight: 500,
          fontSize: '15px',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'rgba(245, 236, 216, 0.75)',
        }}
      >
        {APP_NAME}
      </span>
    </div>
  )
}
