'use client'

import { cn } from '@/lib/cn'
import { useLongPress } from '@/hooks/useLongPress'
import { useQcfFont } from '@/hooks/useQcfFont'
import { qcfFontFamily } from '@/lib/mushaf-fonts'
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
  const qcfFamily = qcfFontFamily(pageNumber)
  const useGlyph = Boolean(codeV2?.trim())
  const localFontReady = useQcfFont(pageNumber, useGlyph && glyphFontReady === undefined)
  const fontReady = glyphFontReady ?? localFontReady
  const longPress = useLongPress(() => onLongPress?.(verseKey))

  const fallback = fallbackText.trim()
  const display = useGlyph && fontReady ? codeV2!.trim() : fallback ? `۝${fallback}` : '۝'
  const glyphMode = useGlyph && fontReady

  const inner = (
    <span
      className={cn('mushaf-ayah-end', glyphMode && 'mushaf-ayah-end--glyph', className)}
      style={{
        fontFamily: glyphMode ? qcfFamily : PLAIN_MUSHAF_FONT,
      }}
      dir="rtl"
      aria-hidden
    >
      {display}
    </span>
  )

  if (!onLongPress) return inner

  return (
    <span className="inline" {...longPress.handlers}>
      {inner}
    </span>
  )
}
