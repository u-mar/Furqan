export type MushafLineKind = 'content' | 'surah-header' | 'basmalah' | 'empty'

export interface MushafLineSegment {
  verseKey: string
  codeV2: string
  isEnd: boolean
  /** The word's position within its verse (1-based) — carried through so a
   *  single verse can be kept word-by-word (Hifdh Test's per-word reveal)
   *  and each segment still says which word it is. */
  position?: number
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
