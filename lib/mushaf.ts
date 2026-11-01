export const TOTAL_MUSHAF_PAGES = 604

/**
 * Juz boundaries: where each juz begins (surah:ayah), as in the bundled Quran
 * data's juz numbers (public/quran-data.json).
 */
export const JUZ_STARTS: { surah: number; ayah: number }[] = [
  { surah: 1, ayah: 1 },
  { surah: 2, ayah: 142 },
  { surah: 2, ayah: 253 },
  { surah: 3, ayah: 93 },
  { surah: 4, ayah: 24 },
  { surah: 4, ayah: 148 },
  { surah: 5, ayah: 82 },
  { surah: 6, ayah: 111 },
  { surah: 7, ayah: 88 },
  { surah: 8, ayah: 41 },
  { surah: 9, ayah: 93 },
  { surah: 11, ayah: 6 },
  { surah: 12, ayah: 53 },
  { surah: 15, ayah: 1 },
  { surah: 17, ayah: 1 },
  { surah: 18, ayah: 75 },
  { surah: 21, ayah: 1 },
  { surah: 23, ayah: 1 },
  { surah: 25, ayah: 21 },
  { surah: 27, ayah: 56 },
  { surah: 29, ayah: 46 },
  { surah: 33, ayah: 31 },
  { surah: 36, ayah: 28 },
  { surah: 39, ayah: 32 },
  { surah: 41, ayah: 47 },
  { surah: 46, ayah: 1 },
  { surah: 51, ayah: 31 },
  { surah: 58, ayah: 1 },
  { surah: 67, ayah: 1 },
  { surah: 78, ayah: 1 },
]

/** The page each juz begins on in the 604-page Madinah mushaf (the same data). */
export const JUZ_START_PAGES: readonly number[] = [
  1, 22, 42, 62, 82, 102, 121, 142, 162, 182, 201, 222, 242, 262, 282, 302, 322, 342, 362, 382, 402, 422,
  442, 462, 482, 502, 522, 542, 562, 582,
]

/** Medinan surah ids (1-indexed). */
const MEDINAN_SURAHS = new Set([
  2, 3, 4, 5, 8, 9, 13, 22, 24, 33, 47, 48, 49, 55, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66,
  98, 99, 110,
])

export function juzForChapter(chapterId: number): number {
  let juz = 1
  for (let i = 0; i < JUZ_STARTS.length; i++) {
    const start = JUZ_STARTS[i]
    if (chapterId > start.surah || (chapterId === start.surah && 1 >= start.ayah)) {
      juz = i + 1
    }
  }
  return juz
}

export function revelationLabel(chapterId: number): 'Meccan' | 'Medinan' {
  return MEDINAN_SURAHS.has(chapterId) ? 'Medinan' : 'Meccan'
}

export function clampPage(page: number): number {
  return Math.min(TOTAL_MUSHAF_PAGES, Math.max(1, Math.round(page)))
}

export const LAST_READ_PAGE_KEY = 'muyassar_read_page'

/** The page last read and the first ayah on it, so Home can name the place without loading the Quran. */
export const LAST_READ_POSITION_KEY = 'muyassar_read_position'
