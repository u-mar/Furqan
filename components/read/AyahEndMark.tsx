'use client'

import { cn } from '@/lib/cn'
import { useLongPress } from '@/hooks/useLongPress'
import { useQcfFont } from '@/hooks/useQcfFont'
import { qcfPageFontFamily } from '@/lib/qcf-page'
import { PLAIN_MUSHAF_FONT } from '@/lib/mushaf-render'

interface AyahEndMarkProps {
  verseKey: string
  pageNumber: number
  /** QCF glyph for ayah end (number inside ornament). */
  codeV2?: string
  /** Plain ayah number fallback (e.g. ٢٥٥). */
  fallbackText: string
  className?: string
  onLongPress?: (verseKey: string) => void
  /** When set, skips per-mark font loading (use one hook on the page). */
  glyphFontReady?: boolean
}

export default function AyahEndMark({
  verseKey,
  pageNumber,
  codeV2,
  fallbackText,
  className,
  onLongPress,
  glyphFontReady,
}: AyahEndMarkProps) {
  const qcfFamily = qcfPageFontFamily(pageNumber)
  const useGlyph = Boolean(codeV2?.trim())
  const { ready: localFontReady } = useQcfFont(pageNumber, useGlyph && glyphFontReady === undefined)
  const fontReady = glyphFontReady ?? localFontReady
  const longPress = useLongPress(() => onLongPress?.(verseKey))

  const fallback = fallbackText.trim()
  const display = fallback ? `۝${fallback}` : '۝'
  const glyphMode = useGlyph && fontReady
  const glyphText = codeV2?.trim() || ''

  const inner = (
    <span
      className={cn('mushaf-ayah-end', glyphMode && 'mushaf-ayah-end--glyph', className)}
      style={{
        fontFamily: glyphMode ? qcfFamily : PLAIN_MUSHAF_FONT,
      }}
      dir="rtl"
      aria-hidden
    >
      {glyphMode ? glyphText : display}
    </span>
  )

  if (!onLongPress) return inner

  return (
    <span className="inline" {...longPress.handlers}>
      {inner}
    </span>
  )
}
