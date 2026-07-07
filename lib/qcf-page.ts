import { buildMushafPageModel, surahHeaderToken } from '@/lib/mushaf-engine'
import type { MushafLineKind, MushafLineModel } from '@/lib/mushaf-engine'
import type { Verse, VerseWord } from '@/types'
import { compareMushafWords, wordOnVisualPage } from '@/lib/mushaf-engine/word-order'

const LINES_PER_PAGE = 15

export interface QcfPageSegment {
  verseKey: string
  text: string
}

export interface QcfPageLine {
  lineNumber: number
  kind: MushafLineKind
  /** Precomposed QCF glyph run for this printed line (from API word order, not UI). */
  text: string
  /** Per-ayah glyph runs on this line (for accurate recitation highlight). */
  segments: QcfPageSegment[]
  verseKeys: string[]
  chapterNumber?: number
}

function mergeAdjacentSegments(segments: QcfPageSegment[]): QcfPageSegment[] {
  const merged: QcfPageSegment[] = []
  for (const seg of segments) {
    const last = merged[merged.length - 1]
    if (last && last.verseKey === seg.verseKey) {
      last.text += seg.text
    } else {
      merged.push({ verseKey: seg.verseKey, text: seg.text })
    }
  }
  return merged
}

export interface QcfPageLayout {
  pageNumber: number
  lines: QcfPageLine[]
  /** Full page glyph string (lines 1–15 concatenated). */
  pageText: string
}

import { qcfPageFontFamily as qcfFamilyForPage } from '@/lib/qcf-font-cdn'

/** QCF font family per page (e.g. QCF_P542) — matches @font-face in mushaf-fonts. */
export function qcfPageFontFamily(pageNumber: number): string {
  return qcfFamilyForPage(pageNumber)
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
    segments: mergeAdjacentSegments(
      line.segments.map((segment) => ({
        verseKey: segment.verseKey,
        text: segment.codeV2,
      }))
    ),
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

/** First few QCF glyphs on a page — used to verify the page font actually renders. */
export function qcfPageSampleGlyphs(verses: Verse[], pageNumber: number): string {
  const { pageText } = buildQcfPageLayout(verses, pageNumber)
  return pageText.slice(0, 12)
}

/** QCF glyph lines for one ayah (wraps at printed mushaf line breaks). */
export function getVerseQcfGlyphLines(verse: Verse, pageNumber: number): string[] {
  const byLine = new Map<number, string[]>()

  for (const word of verse.words || []) {
    if (!wordOnVisualPage(word, pageNumber, verse)) continue
    const code = word.code_v2?.trim()
    if (!code) continue
    const line = word.line_number ?? 1
    const bucket = byLine.get(line) || []
    bucket.push(code)
    byLine.set(line, bucket)
  }

  if (byLine.size === 0) return []

  return [...byLine.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, parts]) => parts.join(''))
}

/** Per-word QCF glyphs for one ayah (reading order). */
export function getVerseQcfGlyphWords(verse: Verse, pageNumber: number): string[] {
  const items: Array<VerseWord & { verseKey: string }> = []

  for (const word of verse.words || []) {
    if (!wordOnVisualPage(word, pageNumber, verse)) continue
    const code = word.code_v2?.trim()
    if (!code) continue
    items.push({ ...word, verseKey: verse.verse_key })
  }

  if (items.length === 0) return []

  items.sort(compareMushafWords)
  return items.map((word) => word.code_v2!.trim())
}

/** QCF glyph run for one ayah on a printed page (same font as mushaf read mode). */
export function getVerseQcfGlyphs(verse: Verse, pageNumber: number): string {
  const items: Array<VerseWord & { verseKey: string }> = []

  for (const word of verse.words || []) {
    if (!wordOnVisualPage(word, pageNumber, verse)) continue
    const code = word.code_v2?.trim()
    if (!code) continue
    items.push({ ...word, verseKey: verse.verse_key })
  }

  if (items.length === 0) return ''

  items.sort(compareMushafWords)
  return items.map((word) => word.code_v2!.trim()).join('')
}

export { LINES_PER_PAGE }
