import { buildMushafPageModel, surahHeaderToken } from '@/lib/mushaf-engine'
import type { MushafLineKind, MushafLineModel } from '@/lib/mushaf-engine'
import type { Verse } from '@/types'

const LINES_PER_PAGE = 15

export interface QcfPageLine {
  lineNumber: number
  kind: MushafLineKind
  /** Precomposed QCF glyph run for this printed line (from API word order, not UI). */
  text: string
  verseKeys: string[]
  chapterNumber?: number
}

export interface QcfPageLayout {
  pageNumber: number
  lines: QcfPageLine[]
  /** Full page glyph string (lines 1–15 concatenated). */
  pageText: string
}

/** QCF font family name per Madinah page (matches dynamic @font-face registration). */
export function qcfPageFontFamily(pageNumber: number): string {
  return `QCF_P${pageNumber}`
}

export function qcfPageFontClass(pageNumber: number): string {
  return `qcf-font-page-${pageNumber}`
}

function lineDisplayText(line: MushafLineModel): string {
  if (line.kind === 'surah-header' && line.chapterNumber) {
    return surahHeaderToken(line.chapterNumber)
  }
  return line.glyphs
}

/**
 * Build fixed 15-line QCF page layout from Quran Foundation word `code_v2` data.
 * All glyph concatenation happens here — UI only renders `line.text` with the page font.
 *
 * Ordering: `lib/mushaf-engine/word-order.ts` — line_number → verse → position → id.
 * Only non-empty `code_v2` tokens are included (ayah ends must be QCF glyphs, not Unicode ۝).
 */
export function buildQcfPageLayout(verses: Verse[], pageNumber: number): QcfPageLayout {
  const model = buildMushafPageModel(verses, pageNumber)
  const lines: QcfPageLine[] = model.lines.map((line) => ({
    lineNumber: line.lineNumber,
    kind: line.kind,
    text: lineDisplayText(line),
    verseKeys: line.verseKeys,
    chapterNumber: line.chapterNumber,
  }))

  const pageText = lines
    .filter((line) => line.kind !== 'empty')
    .map((line) => line.text)
    .join('')

  return { pageNumber, lines, pageText }
}

export function pageHasQcfData(verses: Verse[]): boolean {
  return verses.some((verse) => verse.words?.some((word) => Boolean(word.code_v2?.trim())))
}

export { LINES_PER_PAGE }
