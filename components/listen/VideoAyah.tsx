'use client'

import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useAppSettings } from '@/hooks/useAppSettings'
import type { VerseTimelineEntry } from '@/lib/qari'
import { loadAyah, peekAyah, viewerTranslation, type AyahView } from '@/lib/qari-ayah'
import { ayahParts, loadPhraseTranslations, partFor, wordAt } from '@/lib/qari-ayah-parts'
import { cn } from '@/lib/cn'
import { useT } from '@/lib/i18n'

/**
 * The ayah the reciter is on, in the mushaf's script, with its translation under it in the
 * Quran-edit italic — as the Qari videos show it (components/qari/SwipeFeed.tsx), set larger
 * for a whole screen. A long ayah is shown a phrase at a time, cut where the mushaf pauses;
 * with only the ayah's start and end known, the phrase is placed by time through the ayah.
 */

const TEXT_SHADOW = '0 2px 18px rgba(0, 0, 0, 0.6)'
const TRANSLATION_SHADOW = '0 1px 10px rgba(0, 0, 0, 0.6)'
/** As large as this on one line, and only as small as that before a phrase may wrap. */
const LINE_MAX_PX = 26
const LINE_MIN_PX = 19
/** Ayat after the current one fetched ahead, so each change lands at once. */
const AHEAD = 2

/** The ayah being recited: the last one starting at or before `position` (the first, before that). */
function entryAt(timeline: VerseTimelineEntry[], position: number): number {
  let found = timeline.length ? 0 : -1
  for (let i = 0; i < timeline.length; i++) {
    if (timeline[i].atSeconds > position) break
    found = i
  }
  return found
}

function AyahLine({ words, fontFamily }: { words: string[]; fontFamily: string }) {
  const ref = useRef<HTMLParagraphElement | null>(null)
  const [fit, setFit] = useState({ size: LINE_MAX_PX, wrap: false })
  const text = words.join(' ')
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.whiteSpace = 'nowrap'
    let next = LINE_MAX_PX
    el.style.fontSize = `${next}px`
    while (next > LINE_MIN_PX && el.scrollWidth > el.clientWidth + 1) {
      next -= 1
      el.style.fontSize = `${next}px`
    }
    setFit({ size: next, wrap: el.scrollWidth > el.clientWidth + 1 })
  }, [text, fontFamily])
  return (
    <p
      ref={ref}
      dir="rtl"
      lang="ar"
      className="w-full text-center text-white"
      // The mushaf font has no bold face; forcing one would distort the letters.
      style={{ fontFamily, fontSize: fit.size, whiteSpace: fit.wrap ? 'normal' : 'nowrap', lineHeight: 1.9, fontWeight: 400, textShadow: TEXT_SHADOW, wordSpacing: '0.12em' }}
    >
      {words.map((word, i) => (
        <Fragment key={i}>
          {i > 0 ? ' ' : null}
          {word}
        </Fragment>
      ))}
    </p>
  )
}

export default function VideoAyah({
  timeline,
  position,
  durationSec,
  paused,
}: {
  timeline: VerseTimelineEntry[]
  position: number
  durationSec: number
  paused: boolean
}) {
  const t = useT()
  const index = entryAt(timeline, position)
  const entry = index >= 0 ? timeline[index] : undefined
  const key = entry?.verseKey
  // In the listener's own language: the translation they read the Quran with.
  const edition = viewerTranslation(useAppSettings().translationEditionId)
  const [ayah, setAyah] = useState<AyahView | null>(() => (key ? peekAyah(key, edition) : null))

  // The previous ayah stays up until the next one is ready, so the screen never blanks between them.
  useEffect(() => {
    if (!key) {
      setAyah(null)
      return
    }
    const known = peekAyah(key, edition)
    if (known) {
      setAyah(known)
      return
    }
    let cancelled = false
    void loadAyah(key, edition).then((view) => {
      if (!cancelled && view) setAyah(view)
    })
    return () => {
      cancelled = true
    }
  }, [edition, key])

  // The next few ayat, and the phrases of a long one, asked for ahead.
  useEffect(() => {
    if (index < 0) return
    let cancelled = false
    void (async () => {
      for (const next of timeline.slice(index, index + 1 + AHEAD)) {
        const view = await loadAyah(next.verseKey, edition)
        if (cancelled) return
        const phrases = view ? ayahParts(view.pauseAfter ?? []) : []
        if (phrases.length > 1) await loadPhraseTranslations(next.verseKey, edition, phrases)
        if (cancelled) return
      }
    })()
    return () => {
      cancelled = true
    }
  }, [edition, index, timeline])

  // A phrase at a time, cut where the mushaf pauses: the one the voice has reached.
  const parts = useMemo(() => ayahParts(ayah?.pauseAfter ?? []), [ayah])
  let partIndex = 0
  if (ayah && entry && ayah.verseKey === key) {
    const endsAt = timeline[index + 1]?.atSeconds ?? durationSec
    partIndex = partFor(parts, wordAt(entry, endsAt, position, ayah.words.length))
  }
  partIndex = Math.min(partIndex, parts.length - 1)
  const part = parts[partIndex]
  const split = parts.length > 1

  const [phraseTexts, setPhraseTexts] = useState<Record<string, (string | null)[]>>({})
  useEffect(() => {
    if (!ayah || parts.length < 2) return
    let cancelled = false
    void loadPhraseTranslations(ayah.verseKey, edition, parts).then((texts) => {
      if (!cancelled) setPhraseTexts((prev) => ({ ...prev, [`${edition}|${ayah.verseKey}`]: texts }))
    })
    return () => {
      cancelled = true
    }
  }, [ayah, edition, parts])
  // A phrase's own translation; when none could be worked out for it, the ayah's whole translation.
  const partText = ayah && split ? phraseTexts[`${edition}|${ayah.verseKey}`]?.[partIndex] : undefined
  const translation = ayah ? (split ? (partText === undefined ? null : partText ?? ayah.translation) : ayah.translation) : null
  // The last phrase ends with the ayah's ornament and its number.
  const shownWords = ayah
    ? [...ayah.words.slice(part.start, part.end + 1), ...(partIndex === parts.length - 1 && ayah.endMark ? [ayah.endMark] : [])]
    : []

  if (!ayah) return null
  return (
    <div className={cn('flex w-full flex-col items-center text-center transition-opacity duration-300', paused && 'opacity-60')}>
      <p className="text-[0.78125rem] font-semibold tracking-[0.02em] text-white/75" style={{ textShadow: TRANSLATION_SHADOW }}>
        {t('Ayah {number}', { number: Number(ayah.verseKey.split(':')[1]) })}
      </p>
      <div key={`${ayah.verseKey}-${partIndex}`} className="qari-phrase-in mt-4 flex w-full flex-col items-center">
        <AyahLine words={shownWords} fontFamily={ayah.fontFamily} />
        {translation ? (
          <p
            dir={ayah.translationRtl ? 'rtl' : 'ltr'}
            lang={ayah.translationLang}
            className="mt-3 max-w-[30ch] leading-snug text-white/95"
            // A light italic serif, as Quran edits set it. A right-to-left translation (Urdu,
            // Persian…) in Amiri, which has every Arabic-script letter.
            style={
              ayah.translationRtl
                ? { fontFamily: 'var(--font-amiri), Amiri, serif', fontWeight: 400, textShadow: TRANSLATION_SHADOW, fontSize: 15 }
                : {
                    fontFamily: "var(--font-edit), 'Cormorant Garamond', Georgia, serif",
                    fontStyle: 'italic',
                    fontWeight: 500,
                    textShadow: TRANSLATION_SHADOW,
                    fontSize: 17,
                  }
            }
          >
            {translation}
          </p>
        ) : null}
      </div>
    </div>
  )
}
