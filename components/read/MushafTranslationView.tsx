'use client'

import { useLayoutEffect, useMemo, useRef, type RefObject } from 'react'
import { Copy, Share2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useLongPress } from '@/hooks/useLongPress'
import { useQcfFont } from '@/hooks/useQcfFont'
import { BASMALAH_ORNAMENT } from '@/lib/mushaf-basmalah'
import AyahEndMark from '@/components/read/AyahEndMark'
import { usePageTranslations } from '@/hooks/usePageTranslations'
import { surahHasOpeningBasmalah } from '@/lib/mushaf-basmalah'
import { getVerseArabicText } from '@/lib/quran-display'
import {
  getVerseQcfGlyphWords,
  pageHasQcfData,
  qcfPageFontFamily,
  qcfPageSampleGlyphs,
} from '@/lib/qcf-page'
import type { TranslationLanguageId } from '@/lib/translations'
import type { Chapter, Verse, VerseWord } from '@/types'

interface MushafTranslationViewProps {
  verses: Verse[]
  page: number
  chapters: Chapter[]
  translationLanguage: TranslationLanguageId
  highlightedVerseKey?: string | null
  selectedVerseKey?: string | null
  showArabic?: boolean
  scrollContainerRef?: RefObject<HTMLElement | null>
  followPlaybackScroll?: boolean
  onAyahLongPress?: (verseKey: string) => void
  onAyahSelect?: (verseKey: string) => void
  ayahSelectMode?: boolean
}

function verseNumber(verseKey: string): number {
  return Number(verseKey.split(':')[1] || 0)
}

function surahNumber(verseKey: string): number {
  return Number(verseKey.split(':')[0] || 0)
}

function TranslationQcfAyah({ words }: { words: string[] }) {
  return (
    <div className="mushaf-translation-qcf-ayah" dir="rtl" lang="ar">
      {words.map((word, index) => (
        <span key={index} className="mushaf-translation-qcf-word">
          {word}
        </span>
      ))}
    </div>
  )
}

interface TranslationAyahArticleProps {
  row: {
    verse_key: string
    text_uthmani: string
    qcfWords: string[]
    endWord?: VerseWord
    translation: string
  }
  page: number
  num: number
  surahLabel: string | null
  translator: string
  showBasmalah: boolean
  showArabic: boolean
  showGlyphAyah: boolean
  qcfFontReady: boolean
  loading: boolean
  isReciting: boolean
  isSelected: boolean
  ayahSelectMode: boolean
  onAyahLongPress?: (verseKey: string) => void
  onAyahSelect?: (verseKey: string) => void
  articleRef: (node: HTMLElement | null) => void
}

function TranslationAyahArticle({
  row,
  page,
  num,
  surahLabel,
  translator,
  showBasmalah,
  showArabic,
  showGlyphAyah,
  qcfFontReady,
  loading,
  isReciting,
  isSelected,
  ayahSelectMode,
  onAyahLongPress,
  onAyahSelect,
  articleRef,
}: TranslationAyahArticleProps) {
  const longPress = useLongPress(() => onAyahLongPress?.(row.verse_key))
  const hasTranslation = Boolean(row.translation)

  return (
    <article
      ref={articleRef}
      id={`translation-ayah-${row.verse_key.replace(':', '-')}`}
      data-translation-ayah={row.verse_key}
      className={cn(ayahSelectMode && 'cursor-pointer')}
      onClick={(e) => {
        if (!ayahSelectMode || !onAyahSelect) return
        e.stopPropagation()
        onAyahSelect(row.verse_key)
      }}
      {...(onAyahLongPress ? longPress.handlers : {})}
      onContextMenu={(e) => e.preventDefault()}
    >
      {surahLabel && <h2 className="mushaf-tr-surah-header">{surahLabel}</h2>}

      <div
        className={cn(
          'mushaf-translation-body px-2.5 py-6 transition-colors duration-300',
          isReciting && 'mushaf-translation-body--reciting',
          isSelected && 'ring-1 ring-[var(--mushaf-read-highlight-border)]'
        )}
      >
        {/* meta row — verse badge + quran.com-style actions */}
        <div className="mushaf-tr-meta">
          <span className="mushaf-tr-badge" aria-hidden>
            {num}
          </span>
          <span className="mushaf-tr-key">{row.verse_key}</span>
          <span className="mushaf-tr-actions">
            <button
              type="button"
              className="mushaf-tr-action"
              aria-label={`Copy ayah ${row.verse_key}`}
              onClick={(e) => {
                e.stopPropagation()
                void navigator.clipboard
                  ?.writeText(`${row.text_uthmani}\n\n${row.translation}\n\n(${row.verse_key})`)
                  .catch(() => {})
              }}
            >
              <Copy className="h-[15px] w-[15px]" />
            </button>
            <button
              type="button"
              className="mushaf-tr-action"
              aria-label={`Share ayah ${row.verse_key}`}
              onClick={(e) => {
                e.stopPropagation()
                const text = `${row.text_uthmani}\n\n${row.translation}\n\n(${row.verse_key})`
                if (navigator.share) {
                  void navigator.share({ text }).catch(() => {})
                } else {
                  void navigator.clipboard?.writeText(text).catch(() => {})
                }
              }}
            >
              <Share2 className="h-[15px] w-[15px]" />
            </button>
          </span>
        </div>

        {showBasmalah && (
          <p
            className="mushaf-translation-basmalah mb-3 mt-1 text-center"
            dir="rtl"
            lang="ar"
            aria-label="Basmalah"
          >
            {BASMALAH_ORNAMENT}
          </p>
        )}

        {showArabic && (
          <div
            className={cn(
              'mushaf-translation-arabic',
              showGlyphAyah && 'mushaf-translation-arabic--qcf',
              isReciting && 'mushaf-translation-arabic--reciting'
            )}
            dir="rtl"
            lang="ar"
          >
            {showGlyphAyah ? (
              <TranslationQcfAyah words={row.qcfWords} />
            ) : (
              <p
                className="mushaf-translation-arabic-line mushaf-translation-arabic-line--plain"
                dir="rtl"
                lang="ar"
              >
                {row.text_uthmani}{' '}
                <AyahEndMark
                  verseKey={row.verse_key}
                  pageNumber={row.endWord?.v2_page || row.endWord?.page_number || page}
                  codeV2={row.endWord?.code_v2}
                  fallbackText={row.endWord?.text_uthmani || row.endWord?.text_qpc_hafs || ''}
                  glyphFontReady={qcfFontReady}
                  onLongPress={onAyahLongPress}
                />
              </p>
            )}
          </div>
        )}

        <p className="mushaf-translation-text">
          {row.translation || (loading ? 'Loading…' : 'Translation unavailable.')}
        </p>

        {hasTranslation && <p className="mushaf-tr-translator">— {translator}</p>}
      </div>
    </article>
  )
}

const TRANSLATOR_BY_LANG: Record<TranslationLanguageId, string> = {
  en: 'Sahih International',
  so: 'Mahmud Muhammad Abduh',
}

const AYAH_STACK_GAP_PX = 20
const SCROLL_TOP_PAD_PX = 12

function remainingAyahsFitInView(
  fromIndex: number,
  verseKeys: string[],
  ayahRefs: Map<string, HTMLElement>,
  containerHeight: number
): boolean {
  let total = 0
  for (let i = fromIndex; i < verseKeys.length; i++) {
    const el = ayahRefs.get(verseKeys[i])
    if (!el) continue
    total += el.offsetHeight
    if (i < verseKeys.length - 1) total += AYAH_STACK_GAP_PX
  }
  return total <= containerHeight - SCROLL_TOP_PAD_PX
}

function scrollAyahToContainerTop(
  ayahEl: HTMLElement,
  container: HTMLElement,
  behavior: ScrollBehavior = 'smooth'
) {
  const containerRect = container.getBoundingClientRect()
  const ayahRect = ayahEl.getBoundingClientRect()
  const target = ayahRect.top - containerRect.top + container.scrollTop - SCROLL_TOP_PAD_PX
  container.scrollTo({ top: Math.max(0, target), behavior })
}

export default function MushafTranslationView({
  verses,
  page,
  chapters,
  translationLanguage,
  highlightedVerseKey = null,
  selectedVerseKey = null,
  showArabic = true,
  scrollContainerRef,
  followPlaybackScroll = false,
  onAyahLongPress,
  onAyahSelect,
  ayahSelectMode = false,
}: MushafTranslationViewProps) {
  const chapterNameById = useMemo(
    () => Object.fromEntries(chapters.map((c) => [c.id, c.englishName || c.name])),
    [chapters]
  )
  const translator = TRANSLATOR_BY_LANG[translationLanguage] ?? 'Translation'
  const verseKeys = verses.map((v) => v.verse_key)
  const arabicByKey = Object.fromEntries(
    verses.map((v) => [v.verse_key, getVerseArabicText(v, { omitEndMark: true })])
  )
  const { rows, byKey, loading } = usePageTranslations(
    page,
    true,
    verseKeys,
    arabicByKey,
    translationLanguage
  )
  const ayahRefs = useRef<Map<string, HTMLElement>>(new Map())

  const hasQcf = pageHasQcfData(verses)
  const qcfSample = useMemo(
    () => (hasQcf && page > 0 ? qcfPageSampleGlyphs(verses, page) : ''),
    [hasQcf, page, verses]
  )
  const qcfFamily = qcfPageFontFamily(page)
  const { ready: qcfFontReady } = useQcfFont(page, hasQcf, qcfSample)
  const useQcfGlyphs = hasQcf && qcfFontReady

  const displayRows = verses.map((verse) => {
    const endWord = verse.words?.find((word) => word.char_type_name === 'end')
    const qcfWords = getVerseQcfGlyphWords(verse, page)
    return {
      verse_key: verse.verse_key,
      text_uthmani: arabicByKey[verse.verse_key] || getVerseArabicText(verse),
      qcfWords,
      endWord,
      translation: byKey[verse.verse_key]?.translation || '',
    }
  })

  useLayoutEffect(() => {
    if (!highlightedVerseKey || !followPlaybackScroll) return
    const container = scrollContainerRef?.current
    const el = ayahRefs.current.get(highlightedVerseKey)
    if (!container || !el) return

    const verseKeys = verses.map((v) => v.verse_key)
    const currentIndex = verseKeys.indexOf(highlightedVerseKey)
    if (currentIndex < 0) return

    if (remainingAyahsFitInView(currentIndex, verseKeys, ayahRefs.current, container.clientHeight)) {
      return
    }

    scrollAyahToContainerTop(el, container)
  }, [highlightedVerseKey, followPlaybackScroll, scrollContainerRef, verses])

  if (loading && rows.length === 0) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-300 border-t-teal-600 dark:border-stone-600 dark:border-t-teal-500" />
      </div>
    )
  }

  return (
    <div
      className={cn('mushaf-root pb-8', useQcfGlyphs && 'mushaf-translation-qcf')}
      style={{ '--mushaf-qcf-font-family': qcfFamily } as React.CSSProperties}
    >
      {displayRows.map((row) => {
        const num = verseNumber(row.verse_key)
        const surah = surahNumber(row.verse_key)
        const isReciting = highlightedVerseKey === row.verse_key
        const isSelected = selectedVerseKey === row.verse_key && !isReciting
        const showBasmalah = num === 1 && surahHasOpeningBasmalah(surah)
        const showGlyphAyah = useQcfGlyphs && row.qcfWords.length > 0
        const surahLabel = num === 1 ? chapterNameById[surah] || `Surah ${surah}` : null

        return (
          <TranslationAyahArticle
            key={row.verse_key}
            row={row}
            page={page}
            num={num}
            surahLabel={surahLabel}
            translator={translator}
            showBasmalah={showBasmalah}
            showArabic={showArabic}
            showGlyphAyah={showGlyphAyah}
            qcfFontReady={qcfFontReady}
            loading={loading}
            isReciting={isReciting}
            isSelected={isSelected}
            ayahSelectMode={ayahSelectMode}
            onAyahLongPress={onAyahLongPress}
            onAyahSelect={onAyahSelect}
            articleRef={(node) => {
              if (node) ayahRefs.current.set(row.verse_key, node)
              else ayahRefs.current.delete(row.verse_key)
            }}
          />
        )
      })}
    </div>
  )
}
