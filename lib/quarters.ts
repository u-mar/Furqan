import quarterOpenings from '@/lib/quarter-openings.json'
import quarterStarts from '@/lib/quarter-starts.json'
import { JUZ_STARTS } from '@/lib/mushaf'
import type { ChapterMeta } from '@/lib/chapters-meta'
import { estimatePageForVerse } from '@/lib/chapters-meta'
import { tr } from '@/lib/i18n-core'

export interface QuarterMarker {
  id: string
  juz: number
  indexInJuz: number
  surah: number
  ayah: number
  page: number
  verseKey: string
  surahName: string
}

const QUARTERS_PER_JUZ = 8

/** How a quarter begins, built into the app (scripts/build-quarter-openings.mjs) so the list needs no network. */
export interface QuarterOpening {
  /** Its printed page, which also names the font its glyphs are in. */
  p: number
  /** Its first words, as that page's QCF glyphs. */
  g: string[]
  /** A few plain words, for when that font cannot be had. */
  t: string
}

const OPENINGS = quarterOpenings as Record<string, QuarterOpening>

export function quarterOpening(verseKey: string): QuarterOpening | null {
  return OPENINGS[verseKey] ?? null
}

/** Canonical rubʿ al-ḥizb start ayahs (240), from Quran.com API. */
const CANONICAL_QUARTER_STARTS = quarterStarts as string[]

function parseVerseKey(key: string): { surah: number; ayah: number } {
  const [s, a] = key.split(':')
  return { surah: Number(s) || 1, ayah: Number(a) || 1 }
}

export function buildQuarterMarkers(meta: ChapterMeta[]): QuarterMarker[] {
  const nameById = Object.fromEntries(meta.map((c) => [c.id, c.name_simple]))
  const markers: QuarterMarker[] = []

  for (let j = 0; j < JUZ_STARTS.length; j++) {
    const juz = j + 1
    const baseIndex = j * QUARTERS_PER_JUZ

    for (let q = 0; q < QUARTERS_PER_JUZ; q++) {
      const verseKey = CANONICAL_QUARTER_STARTS[baseIndex + q]
      if (!verseKey) continue

      const { surah, ayah } = parseVerseKey(verseKey)
      const page = quarterOpening(verseKey)?.p ?? estimatePageForVerse(surah, ayah, meta)

      markers.push({
        id: `${juz}-${q + 1}`,
        juz,
        indexInJuz: q + 1,
        surah,
        ayah,
        page,
        verseKey,
        surahName: nameById[surah] || tr('Surah {surah}', { surah }),
      })
    }
  }

  return markers
}
