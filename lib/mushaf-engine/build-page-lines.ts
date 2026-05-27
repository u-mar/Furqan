import type { Verse, VerseWord } from '@/types'
import type { MushafLineModel, MushafLineSegment, MushafPageModel } from '@/lib/mushaf-engine/types'

const LINES_PER_PAGE = 15
const BASMALAH_GLYPH = '﷽'

function verseOrder(verseKey: string): number {
  const [s, a] = verseKey.split(':').map(Number)
  return (s || 0) * 1000 + (a || 0)
}

function wordOnPage(word: VerseWord, pageNumber: number, verse: Verse): boolean {
  const page = word.v2_page || word.page_number || verse.page_number || 0
  return page === pageNumber
}

function collectPageWords(verses: Verse[], pageNumber: number): Array<VerseWord & { verseKey: string }> {
  const items: Array<VerseWord & { verseKey: string }> = []

  for (const verse of verses) {
    for (const word of verse.words || []) {
      if (!wordOnPage(word, pageNumber, verse)) continue
      const code = word.code_v2?.trim()
      if (!code && word.char_type_name !== 'end') continue
      items.push({ ...word, verseKey: verse.verse_key })
    }
  }

  items.sort((a, b) => {
    const lineDiff = (a.line_number || 1) - (b.line_number || 1)
    if (lineDiff !== 0) return lineDiff
    return verseOrder(a.verseKey) - verseOrder(b.verseKey) || a.position - b.position
  })

  return items
}

function markSurahDecorations(
  verses: Verse[],
  pageNumber: number,
  lineKinds: Map<number, Pick<MushafLineModel, 'kind' | 'chapterNumber'>>
): void {
  for (const verse of verses) {
    const chapter = Number(verse.verse_key.split(':')[0])
    const ayah = Number(verse.verse_key.split(':')[1])
    if (ayah !== 1) continue

    const firstOnPage = verse.words?.find((w) => wordOnPage(w, pageNumber, verse))
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

  if (decoration?.kind === 'basmalah') {
    return {
      lineNumber,
      kind: 'basmalah',
      glyphs: BASMALAH_GLYPH,
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
    const lineNumber = word.line_number || 1
    const segment: MushafLineSegment = {
      verseKey: word.verseKey,
      codeV2: word.code_v2?.trim() || word.text_uthmani?.trim() || '',
      isEnd: word.char_type_name === 'end',
    }
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
