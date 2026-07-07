import quarterStarts from '@/lib/quarter-starts.json'
import { juzPageRangeFromVerses, juzStartVerseKey } from '@/lib/juz-pages'
import { JUZ_STARTS, TOTAL_MUSHAF_PAGES } from '@/lib/mushaf'
import { getOfflineQuranSnapshot } from '@/lib/local-quran-store'
import { getVisualPageForVerse } from '@/lib/quran'
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

export async function resolveBoundaryIndex(): Promise<MushafBoundaryIndex> {
  const snapshot = getOfflineQuranSnapshot()
  if (snapshot?.verses?.length) {
    return buildBoundaryIndexFromVerses(snapshot.verses)
  }

  const byPage = new Map<number, MushafBoundary>()

  for (let juz = 1; juz <= 30; juz++) {
    const fallback = Math.max(1, Math.ceil((juz - 1) * (TOTAL_MUSHAF_PAGES / 30)))
    const page = await getVisualPageForVerse(juzStartVerseKey(juz), fallback)
    byPage.set(page, { kind: 'juz', juz })
  }

  for (let j = 0; j < JUZ_STARTS.length; j++) {
    const juz = j + 1
    const quarter5Key = CANONICAL_QUARTER_STARTS[j * QUARTERS_PER_JUZ + 4]
    if (!quarter5Key) continue

    const page = await getVisualPageForVerse(quarter5Key, 1)
    if (byPage.has(page)) continue

    byPage.set(page, {
      kind: 'hizb',
      juz,
      hizb: globalHizbNumber(juz, 2),
    })
  }

  return { byPage }
}

export function boundaryAtPage(index: MushafBoundaryIndex, page: number): MushafBoundary | null {
  return index.byPage.get(page) ?? null
}
