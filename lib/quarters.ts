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

export function buildQuarterMarkers(meta: ChapterMeta[]): QuarterMarker[] {
  const markers: QuarterMarker[] = []
  const nameById = Object.fromEntries(meta.map((c) => [c.id, c.name_simple]))

  for (let j = 0; j < JUZ_STARTS.length; j++) {
    const juz = j + 1
    const start = JUZ_STARTS[j]
    const end = JUZ_STARTS[j + 1]
    const startPage = estimatePageForVerse(start.surah, start.ayah, meta)
    const endPage = end
      ? estimatePageForVerse(end.surah, end.ayah, meta) - 1
      : 604

    for (let q = 0; q < QUARTERS_PER_JUZ; q++) {
      const page =
        q === 0
          ? startPage
          : Math.min(endPage, Math.round(startPage + ((endPage - startPage) * q) / QUARTERS_PER_JUZ))

      let surah = start.surah
      let ayah = start.ayah
      if (q > 0) {
        const progress = q / QUARTERS_PER_JUZ
        const nextSurah = end?.surah ?? 114
        const nextAyah = end?.ayah ?? 1
        surah = Math.round(start.surah + (nextSurah - start.surah) * progress) || start.surah
        ayah = q === QUARTERS_PER_JUZ - 1 && end ? end.ayah : Math.max(1, Math.round(start.ayah + progress * 40))
        if (surah > nextSurah) surah = nextSurah
      }

      const verseKey = `${surah}:${ayah}`
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
