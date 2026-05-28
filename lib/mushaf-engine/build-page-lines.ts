import type { Verse, VerseWord } from '@/types'
import type { MushafLineModel, MushafLineSegment, MushafPageModel } from '@/lib/mushaf-engine/types'
import {
  compareMushafWords,
  sortVersesByKey,
  wordOnVisualPage,
} from '@/lib/mushaf-engine/word-order'

const LINES_PER_PAGE = 15

function collectPageWords(verses: Verse[], pageNumber: number): Array<VerseWord & { verseKey: string }> {
  const items: Array<VerseWord & { verseKey: string }> = []

  for (const verse of sortVersesByKey(verses)) {
    for (const word of verse.words || []) {
      if (!wordOnVisualPage(word, pageNumber, verse)) continue

      const code = word.code_v2?.trim()
      const isEnd = word.char_type_name === 'end'

      if (!code) {
        if (isEnd) continue
        continue
      }

      items.push({ ...word, verseKey: verse.verse_key })
    }
  }

  items.sort(compareMushafWords)
  return items
}

function markSurahDecorations(
  verses: Verse[],
  pageNumber: number,
  lineKinds: Map<number, Pick<MushafLineModel, 'kind' | 'chapterNumber'>>
): void {
  for (const verse of sortVersesByKey(verses)) {
    const chapter = Number(verse.verse_key.split(':')[0])
    const ayah = Number(verse.verse_key.split(':')[1])
    if (ayah !== 1) continue

    const pageWords = (verse.words || [])
      .filter((w) => wordOnVisualPage(w, pageNumber, verse))
      .sort((a, b) => a.position - b.position)

    const firstOnPage = pageWords[0]
    const firstLine = firstOnPage?.line_number
    if (!firstLine) continue

    const hasBasmalah = chapter !== 1 && chapter !== 9
    const headerLine = firstLine - (hasBasmalah ? 2 : 1)
    const basmalahLine = firstLine - 1

    if (headerLine >= 1) {
      lineKinds.set(headerLine, { kind: 'surah-header', chapterNumber: chapter })
    }
    if (hasBasmalah && basmalahLine >= 1) {
      lineKinds.set(basmalahLine, { kind: 'basmalah', chapterNumber: chapter })
    }
  }
}

function segmentFromWord(word: VerseWord & { verseKey: string }): MushafLineSegment | null {
  const codeV2 = word.code_v2?.trim()
  if (!codeV2) return null

  return {
    verseKey: word.verseKey,
    codeV2,
    isEnd: word.char_type_name === 'end',
  }
}

function buildLineModel(
  lineNumber: number,
  segments: MushafLineSegment[],
  decoration?: Pick<MushafLineModel, 'kind' | 'chapterNumber'>
): MushafLineModel {
  const glyphs = segments.map((s) => s.codeV2).join('')
  const verseKeys = [...new Set(segments.map((s) => s.verseKey))]

  if (decoration?.kind === 'surah-header') {
    return {
      lineNumber,
      kind: 'surah-header',
      glyphs: '',
      verseKeys,
      segments,
      chapterNumber: decoration.chapterNumber,
    }
  }

  if (decoration?.kind === 'basmalah' && !glyphs) {
    return {
      lineNumber,
      kind: 'basmalah',
      glyphs: '',
      verseKeys,
      segments,
      chapterNumber: decoration.chapterNumber,
    }
  }

  if (!glyphs && segments.length === 0) {
    return {
      lineNumber,
      kind: 'empty',
      glyphs: '',
      verseKeys: [],
      segments: [],
    }
  }

  return {
    lineNumber,
    kind: 'content',
    glyphs,
    verseKeys,
    segments,
  }
}

/** Build fixed 15-line mushaf page model from verse word data. */
export function buildMushafPageModel(verses: Verse[], pageNumber: number): MushafPageModel {
  const pageWords = collectPageWords(verses, pageNumber)
  const lineSegments = new Map<number, MushafLineSegment[]>()
  const lineKinds = new Map<number, Pick<MushafLineModel, 'kind' | 'chapterNumber'>>()

  markSurahDecorations(verses, pageNumber, lineKinds)

  for (const word of pageWords) {
    const segment = segmentFromWord(word)
    if (!segment) continue

    const lineNumber = word.line_number || 1
    const bucket = lineSegments.get(lineNumber) || []
    bucket.push(segment)
    lineSegments.set(lineNumber, bucket)

    if (lineKinds.get(lineNumber)?.kind === 'surah-header' && segment.codeV2) {
      lineKinds.set(lineNumber, { kind: 'content' })
    }
    if (lineKinds.get(lineNumber)?.kind === 'basmalah' && segment.codeV2) {
      lineKinds.set(lineNumber, { kind: 'content' })
    }
  }

  const lines: MushafLineModel[] = []
  for (let lineNumber = 1; lineNumber <= LINES_PER_PAGE; lineNumber += 1) {
    const segments = lineSegments.get(lineNumber) || []
    const decoration = lineKinds.get(lineNumber)
    lines.push(buildLineModel(lineNumber, segments, decoration))
  }

  return { pageNumber, lines }
}

export function surahHeaderToken(chapterNumber: number): string {
  return `surah${String(chapterNumber).padStart(3, '0')}`
}
