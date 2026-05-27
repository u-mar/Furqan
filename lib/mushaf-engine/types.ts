export type MushafLineKind = 'content' | 'surah-header' | 'basmalah' | 'empty'

export interface MushafLineSegment {
  verseKey: string
  codeV2: string
  isEnd: boolean
}

export interface MushafLineModel {
  lineNumber: number
  kind: MushafLineKind
  /** Concatenated QCF v2 glyph string for this line (no spaces). */
  glyphs: string
  verseKeys: string[]
  segments: MushafLineSegment[]
  chapterNumber?: number
}

export interface MushafPageModel {
  pageNumber: number
  lines: MushafLineModel[]
}
