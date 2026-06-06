'use client'

import { cn } from '@/lib/cn'

interface AyahTranslationBlockProps {
  verseKey: string
  arabicText: string
  translation: string | null
  loading?: boolean
  compact?: boolean
  showTranslation?: boolean
  className?: string
}

export default function AyahTranslationBlock({
  verseKey,
  arabicText,
  translation,
  loading = false,
  compact = false,
  showTranslation = true,
  className,
}: AyahTranslationBlockProps) {
  const ayahNum = verseKey.split(':')[1] || ''
  const surahNum = verseKey.split(':')[0] || ''
  const displayArabic = arabicText.trim() || 'Arabic text unavailable for this ayah.'

  return (
    <div className={cn('space-y-3', className)}>
      <div
        className={cn(
          'rounded-2xl border border-teal-500/25 bg-[var(--mushaf-read-bg)] px-4',
          compact ? 'py-3' : 'py-4'
        )}
      >
        <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-teal-600 dark:text-teal-400">
          {surahNum}:{ayahNum}
        </p>
        <p
          className="mushaf-translation-arabic text-center text-[clamp(1.2rem,4.8vw,1.65rem)] leading-[2.15] text-[var(--mushaf-read-text)]"
          dir="rtl"
          lang="ar"
        >
          {displayArabic}
        </p>
      </div>

      {showTranslation ? (
        <div className="mushaf-translation-body rounded-2xl px-4 py-3.5">
          <p className="text-left mushaf-translation-text">
            <span className="mushaf-translation-ayah-num">({ayahNum})</span>{' '}
            {loading ? 'Loading translation…' : translation || 'Translation unavailable.'}
          </p>
        </div>
      ) : null}
    </div>
  )
}
