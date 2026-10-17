import quarterStarts from '@/lib/quarter-starts.json'
import mushafPageIndex from '@/lib/mushaf-page-index.json'
import { juzPageRangeFromVerses } from '@/lib/juz-pages'
import { JUZ_STARTS } from '@/lib/mushaf'
import type { Verse } from '@/types'

export type BoundaryKind = 'juz' | 'hizb'

export interface MushafBoundary {
  kind: BoundaryKind
  juz: number
  hizb?: number
}

export interface MushafBoundaryIndex {
  byPage: Map<number, MushafBoundary>
}

const QUARTERS_PER_JUZ = 8
const CANONICAL_QUARTER_STARTS = quarterStarts as string[]

function pageFromVerse(verse: Verse): number {
  const word = verse.words?.find((w) => w.char_type_name !== 'end') ?? verse.words?.[0]
  return word?.v2_page || word?.page_number || verse.page_number || 1
}

function pageForVerseKey(verses: Verse[], verseKey: string): number | null {
  const verse = verses.find((v) => v.verse_key === verseKey)
  if (!verse) return null
  return pageFromVerse(verse)
}

/** Global ḥizb number 1–60 (two per juz). */
export function globalHizbNumber(juz: number, hizbInJuz: 1 | 2): number {
  return (juz - 1) * 2 + hizbInJuz
}

export function buildBoundaryIndexFromVerses(verses: Verse[]): MushafBoundaryIndex {
  const byPage = new Map<number, MushafBoundary>()

  for (let juz = 1; juz <= 30; juz++) {
    const { startPage } = juzPageRangeFromVerses(verses, juz)
    byPage.set(startPage, { kind: 'juz', juz })
  }

  for (let j = 0; j < JUZ_STARTS.length; j++) {
    const juz = j + 1
    const quarter5Key = CANONICAL_QUARTER_STARTS[j * QUARTERS_PER_JUZ + 4]
    if (!quarter5Key) continue

    const page = pageForVerseKey(verses, quarter5Key)
    if (!page || byPage.has(page)) continue

    byPage.set(page, {
      kind: 'hizb',
      juz,
      hizb: globalHizbNumber(juz, 2),
    })
  }

  return { byPage }
}

/**
 * Where each juz and each second hizb starts. These never change, so they are
 * worked out once and shipped with the app (lib/mushaf-page-index.json):
 * finding them used to load the whole Quran.
 */
export async function resolveBoundaryIndex(): Promise<MushafBoundaryIndex> {
  const byPage = new Map<number, MushafBoundary>()
  mushafPageIndex.juz.forEach(([startPage], j) => byPage.set(startPage, { kind: 'juz', juz: j + 1 }))
  mushafPageIndex.hizb2.forEach((page, j) => {
    if (!page || byPage.has(page)) return
    byPage.set(page, { kind: 'hizb', juz: j + 1, hizb: globalHizbNumber(j + 1, 2) })
  })
  return { byPage }
}

export function boundaryAtPage(index: MushafBoundaryIndex, page: number): MushafBoundary | null {
  return index.byPage.get(page) ?? null
}
