import quarterStarts from '@/lib/quarter-starts.json'
import { JUZ_STARTS } from '@/lib/mushaf'
import type { ChapterMeta } from '@/lib/chapters-meta'
import { estimatePageForVerse } from '@/lib/chapters-meta'

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
      const page = estimatePageForVerse(surah, ayah, meta)

      markers.push({
        id: `${juz}-${q + 1}`,
        juz,
        indexInJuz: q + 1,
        surah,
        ayah,
        page,
        verseKey,
        surahName: nameById[surah] || `Surah ${surah}`,
      })
    }
  }

  return markers
}
