import { NextRequest, NextResponse } from 'next/server'
import {
  getTranslationsByPageServer,
  getVerseByKeyServer,
  getVersesByPageServer,
} from '@/lib/quran-server'
import {
  DEFAULT_TRANSLATION_EDITION,
  isTranslationEditionId,
  languageForEdition,
  quranComTranslationId,
  translationLanguageLabel,
} from '@/lib/translations'
import { translatePart, type PartTranslation } from '@/lib/part-translation'
import type { Verse } from '@/types'
import hadiToureTimings from '@/lib/reciter-timings/hadi_toure.json'

const QURAN_API_BASE = process.env.QURAN_API_BASE || 'https://api.quran.com/api/v4'
const API_TIMEOUT_MS = 20_000

/** Ayah timings that ship with the app, for reciters no public API has them for: verse key → [start, end] ms. */
const BUNDLED_TIMINGS: Record<string, Record<string, [number, number]>> = {
  hadi_toure: hadiToureTimings as unknown as Record<string, [number, number]>,
}

// A mushaf glyph run is Arabic presentation-form codepoints only. The upstream
// API has occasionally returned a `code_v2` string with a stray ASCII letter
// spliced in, which renders as a literal Latin letter in the middle of the
// Quran text — reject the whole page so the caller falls back to the
// verified offline bundle instead of showing corrupted Quran text.
const ASCII_LETTER_RE = /[A-Za-z]/

function hasCorruptedGlyphs(verses: Verse[]): boolean {
  return verses.some((verse) =>
    verse.words?.some((word) => Boolean(word.code_v2 && ASCII_LETTER_RE.test(word.code_v2)))
  )
}

async function fetchQcfPage(page: number): Promise<Verse[]> {
  const params = new URLSearchParams({
    fields: 'code_v2',
    words: 'true',
    word_fields: 'code_v2,text_qpc_hafs,text_uthmani,line_number,v2_page,page_number,char_type_name',
    mushaf: '1',
  })
  const response = await fetch(`${QURAN_API_BASE}/verses/by_page/${page}?${params.toString()}`, {
    next: { revalidate: 60 * 60 * 24 * 30 },
    signal: AbortSignal.timeout(API_TIMEOUT_MS),
  })

  if (!response.ok) {
    throw new Error(`Quran API page fetch failed: ${response.statusText}`)
  }

  const data = (await response.json()) as { verses?: Verse[] }
  const verses = data.verses || []
  if (hasCorruptedGlyphs(verses)) {
    throw new Error(`Quran API page ${page} returned corrupted glyph data`)
  }
  return verses
}

async function fetchVisualQcfPage(page: number): Promise<Verse[]> {
  const candidatePages = [page - 1, page, page + 1].filter(
    (candidatePage) => candidatePage >= 1 && candidatePage <= 604
  )
  const pageResults = await Promise.all(candidatePages.map((candidatePage) => fetchQcfPage(candidatePage)))
  const verseMap = new Map<string, Verse>()

  for (const verse of pageResults.flat()) {
    const pageWords = (verse.words || []).filter((word) => {
      const visualPage = word.v2_page || word.page_number || verse.page_number
      return visualPage === page
    })

    if (pageWords.length > 0) {
      verseMap.set(verse.verse_key, {
        ...verse,
        page_number: page,
        words: pageWords,
      })
    }
  }

  return Array.from(verseMap.values()).sort((a, b) => {
    const [aChapter, aVerse] = a.verse_key.split(':').map(Number)
    const [bChapter, bVerse] = b.verse_key.split(':').map(Number)
    return aChapter - bChapter || aVerse - bVerse
  })
}

async function fetchVerseVisualPage(verseKey: string): Promise<number | null> {
  const params = new URLSearchParams({ verse_key: verseKey })
  const response = await fetch(`${QURAN_API_BASE}/quran/verses/code_v2?${params.toString()}`, {
    next: { revalidate: 60 * 60 * 24 * 30 },
    signal: AbortSignal.timeout(API_TIMEOUT_MS),
  })

  if (!response.ok) {
    throw new Error(`Quran API visual page fetch failed: ${response.statusText}`)
  }

  const data = (await response.json()) as { verses?: Array<{ v2_page?: number }> }
  return data.verses?.[0]?.v2_page || null
}

async function fetchVisualPages(params: URLSearchParams): Promise<Record<string, number>> {
  const response = await fetch(`${QURAN_API_BASE}/quran/verses/code_v2?${params.toString()}`, {
    next: { revalidate: 60 * 60 * 24 * 30 },
    signal: AbortSignal.timeout(API_TIMEOUT_MS),
  })

  if (!response.ok) {
    throw new Error(`Quran API visual pages fetch failed: ${response.statusText}`)
  }

  const data = (await response.json()) as { verses?: Array<{ verse_key: string; v2_page?: number }> }
  return Object.fromEntries((data.verses || []).map((verse) => [verse.verse_key, verse.v2_page || 1]))
}

interface TranslationItem {
  verse_key: string
  text_uthmani: string
  translation: string
}

async function fetchTranslationsFromAlQuranCloud(
  page: number,
  editionId: string
): Promise<TranslationItem[]> {
  const response = await fetch(`https://api.alquran.cloud/v1/page/${page}/${editionId}`, {
    signal: AbortSignal.timeout(API_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error('AlQuran Cloud translation failed')

  const payload = (await response.json()) as {
    data?: {
      ayahs?: Array<{
        text: string
        numberInSurah: number
        surah: { number: number }
      }>
    }
  }

  const offline = await getVersesByPageServer(page)
  const arabicByKey = Object.fromEntries(offline.map((v) => [v.verse_key, v.text_uthmani]))

  return (payload.data?.ayahs || []).map((a) => {
    const verse_key = `${a.surah.number}:${a.numberInSurah}`
    return {
      verse_key,
      text_uthmani: arabicByKey[verse_key] || '',
      translation: a.text,
    }
  })
}

/** Quran.com marks footnotes and emphasis with HTML; the app shows plain text. */
function plainTranslation(html: string): string {
  return html
    .replace(/<sup[^>]*>.*?<\/sup>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

/** One mushaf page of one Quran.com translation, verse by verse. */
async function fetchTranslationsFromQuranCom(page: number, translationId: number): Promise<TranslationItem[]> {
  const params = new URLSearchParams({ translations: String(translationId), per_page: '50', fields: 'verse_key' })
  const response = await fetch(`${QURAN_API_BASE}/verses/by_page/${page}?${params.toString()}`, {
    // Translations do not change, so a page is kept for a month.
    next: { revalidate: 60 * 60 * 24 * 30 },
    signal: AbortSignal.timeout(API_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error('Quran.com translation failed')

  const payload = (await response.json()) as {
    verses?: Array<{ verse_key: string; translations?: Array<{ text?: string }> }>
  }
  const offline = await getVersesByPageServer(page)
  const arabicByKey = Object.fromEntries(offline.map((v) => [v.verse_key, v.text_uthmani]))

  return (payload.verses || []).map((verse) => ({
    verse_key: verse.verse_key,
    text_uthmani: arabicByKey[verse.verse_key] || '',
    translation: plainTranslation(verse.translations?.[0]?.text || ''),
  }))
}

async function fetchTranslationsForPage(page: number, editionId: string): Promise<TranslationItem[]> {
  const quranComId = quranComTranslationId(editionId)
  if (quranComId !== null) {
    try {
      const rows = await fetchTranslationsFromQuranCom(page, quranComId)
      if (rows.some((r) => r.translation.length > 0)) return rows
    } catch (err) {
      console.warn('Quran.com translations failed:', err)
    }
    return []
  }

  try {
    const cloud = await fetchTranslationsFromAlQuranCloud(page, editionId)
    if (cloud.length > 0 && cloud.some((r) => r.translation.length > 0)) {
      return cloud
    }
  } catch (err) {
    console.warn('AlQuran Cloud translations failed:', err)
  }

  if (editionId === 'en.sahih') {
    const offline = await getTranslationsByPageServer(page)
    return offline.filter((r) => r.translation.length > 0)
  }

  return []
}

/** Parts already worked out, so sharing the same few words again answers at once. */
const PART_CACHE = new Map<string, PartTranslation>()
const PART_CACHE_LIMIT = 2000

/**
 * The meaning of each word of an ayah in one language, from Quran.com. A
 * language it has no word meanings in comes back in English, so those count
 * as missing rather than being shown under, say, a Somali translation.
 */
async function wordMeanings(verseKey: string, wordCount: number, language: string): Promise<string[] | null> {
  try {
    // `language` is what picks the word meanings' language; `word_translation_language` alone is ignored.
    const params = new URLSearchParams({ words: 'true', language, word_translation_language: language })
    const res = await fetch(`${QURAN_API_BASE}/verses/by_key/${encodeURIComponent(verseKey)}?${params.toString()}`, {
      next: { revalidate: 60 * 60 * 24 * 30 },
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    })
    if (!res.ok) return null
    const data = (await res.json()) as {
      verse?: { words?: { char_type_name?: string; translation?: { text?: string | null; language_name?: string } | null }[] }
    }
    const words = (data.verse?.words ?? []).filter((w) => w.char_type_name === 'word')
    if (words.length !== wordCount) return null
    if (language !== 'en' && words.every((w) => (w.translation?.language_name ?? 'english').toLowerCase() === 'english')) {
      return null
    }
    const meanings = words.map((w) => (w.translation?.text ?? '').trim())
    return meanings.some(Boolean) ? meanings : null
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get('type')

    if (type === 'verse') {
      const verseKey = searchParams.get('verseKey')
      if (!verseKey) {
        return NextResponse.json({ error: 'verseKey parameter required' }, { status: 400 })
      }
      // The server reader, not the browser one: that version waits on
      // IndexedDB and a relative fetch, neither of which exists here, and hung
      // until the request timed out.
      const verse = await getVerseByKeyServer(verseKey)
      if (!verse) {
        return NextResponse.json({ error: 'Verse not found' }, { status: 404 })
      }
      // Quran text does not change, so a verse can be kept indefinitely.
      return NextResponse.json(verse, {
        headers: { 'Cache-Control': 'public, max-age=31536000, immutable' },
      })
    }

    if (type === 'page') {
      const page = Number(searchParams.get('page'))
      if (!page || page < 1 || page > 604) {
        return NextResponse.json({ error: 'valid page parameter (1-604) required' }, { status: 400 })
      }

      try {
        const verses = await fetchVisualQcfPage(page)
        if (verses.length > 0) {
          return NextResponse.json(verses)
        }
      } catch (err) {
        console.warn(`Quran API page ${page} failed, using offline data:`, err)
      }

      const verses = await getVersesByPageServer(page)
      if (verses.length === 0) {
        return NextResponse.json({ error: 'No verses found for this page' }, { status: 404 })
      }
      return NextResponse.json(verses)
    }

    if (type === 'part-translation') {
      const verseKey = searchParams.get('verse') ?? ''
      const edition = searchParams.get('edition') ?? ''
      const start = Number(searchParams.get('start'))
      const end = Number(searchParams.get('end'))
      if (!/^\d{1,3}:\d{1,3}$/.test(verseKey) || !isTranslationEditionId(edition) || !Number.isInteger(start) || !Number.isInteger(end)) {
        return NextResponse.json({ error: 'verse, edition, start and end required' }, { status: 400 })
      }

      const cacheKey = `${edition}|${verseKey}|${start}|${end}`
      const known = PART_CACHE.get(cacheKey)
      if (known) return NextResponse.json(known)

      const verse = await getVerseByKeyServer(verseKey)
      if (!verse) return NextResponse.json({ error: 'Verse not found' }, { status: 404 })
      // The same words, in the same order, as the share page counts them.
      const words = (verse.words ?? []).filter(
        (w) => w.char_type_name === 'word' && (w.text_uthmani || w.text_qpc_hafs || '').trim()
      )
      if (start < 0 || end < start || end >= words.length) {
        return NextResponse.json({ error: 'start and end must be within the ayah' }, { status: 400 })
      }

      const rows = verse.page_number ? await fetchTranslationsForPage(verse.page_number, edition) : []
      const translation = rows.find((r) => r.verse_key === verseKey)?.translation?.trim()
      if (!translation) return NextResponse.json({ text: null, source: null })

      const language = languageForEdition(edition)
      const part = await translatePart({
        arabicWords: words.map((w) => (w.text_uthmani || w.text_qpc_hafs || '').trim()),
        glosses: await wordMeanings(verseKey, words.length, language),
        translation,
        start,
        end,
        language,
        languageName: translationLanguageLabel(language),
      })
      if (!part) return NextResponse.json({ text: null, source: null })

      // The model's answers are kept; a matched one only briefly, in case the model is switched on.
      if (part.source === 'ai') {
        if (PART_CACHE.size >= PART_CACHE_LIMIT) PART_CACHE.delete(PART_CACHE.keys().next().value as string)
        PART_CACHE.set(cacheKey, part)
      }
      return NextResponse.json(part, {
        headers: {
          'Cache-Control':
            part.source === 'ai' ? 'public, max-age=2592000' : part.source === 'matched' ? 'public, max-age=3600' : 'no-store',
        },
      })
    }

    if (type === 'translations') {
      const page = Number(searchParams.get('page'))
      if (!page || page < 1 || page > 604) {
        return NextResponse.json({ error: 'valid page parameter required' }, { status: 400 })
      }
      const requestedEdition = searchParams.get('edition')
      const lang = searchParams.get('lang') === 'so' ? 'so' : 'en'
      const editionId = isTranslationEditionId(requestedEdition)
        ? requestedEdition
        : DEFAULT_TRANSLATION_EDITION[lang]
      const items = await fetchTranslationsForPage(page, editionId)
      return NextResponse.json(items)
    }

    if (type === 'chapter-audio' && searchParams.get('source') === 'local') {
      const timings = BUNDLED_TIMINGS[searchParams.get('reciter') ?? '']
      const chapter = Number(searchParams.get('chapter'))
      if (!timings || !chapter || chapter < 1 || chapter > 114) {
        return NextResponse.json({ error: 'reciter and chapter (1-114) required' }, { status: 400 })
      }
      const ayat = Object.entries(timings)
        .filter(([key]) => key.startsWith(`${chapter}:`))
        .map(([key, [from, to]]) => ({ key, from, to }))
        .sort((a, b) => Number(a.key.split(':')[1]) - Number(b.key.split(':')[1]))
      if (ayat.length === 0) return NextResponse.json({ error: 'No timings for this surah' }, { status: 404 })
      return NextResponse.json({ ayat }, { headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=2592000' } })
    }

    if (type === 'chapter-audio') {
      const reciter = Number(searchParams.get('reciter'))
      const chapter = Number(searchParams.get('chapter'))
      if (!reciter || !chapter || chapter < 1 || chapter > 114) {
        return NextResponse.json({ error: 'reciter and chapter (1-114) required' }, { status: 400 })
      }
      if (searchParams.get('source') === 'mp3quran') {
        const timing = await fetch(`https://mp3quran.net/api/v3/ayat_timing?surah=${chapter}&read=${reciter}`, {
          next: { revalidate: 60 * 60 * 24 * 30 },
          signal: AbortSignal.timeout(API_TIMEOUT_MS),
        })
        if (!timing.ok) return NextResponse.json({ error: 'Audio timings unavailable' }, { status: 502 })
        const rows = (await timing.json()) as Array<{ ayah: number; start_time: number; end_time: number }>
        if (!Array.isArray(rows) || rows.length === 0) {
          return NextResponse.json({ error: 'No timings for this recitation' }, { status: 404 })
        }
        return NextResponse.json(
          { ayat: rows.map((r) => ({ key: `${chapter}:${r.ayah}`, from: r.start_time, to: r.end_time })) },
          { headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=2592000' } }
        )
      }
      const response = await fetch(`${QURAN_API_BASE}/chapter_recitations/${reciter}/${chapter}?segments=true`, {
        next: { revalidate: 60 * 60 * 24 * 30 },
        signal: AbortSignal.timeout(API_TIMEOUT_MS),
      })
      if (!response.ok) return NextResponse.json({ error: 'Audio timings unavailable' }, { status: 502 })
      const payload = (await response.json()) as {
        audio_file?: {
          audio_url?: string
          timestamps?: Array<{ verse_key: string; timestamp_from: number; timestamp_to: number }>
        }
      }
      const file = payload.audio_file
      if (!file?.audio_url || !file.timestamps?.length) {
        return NextResponse.json({ error: 'No timings for this recitation' }, { status: 404 })
      }
      // Only the start and end of each ayah: the word-by-word segments are not needed here.
      return NextResponse.json(
        {
          url: file.audio_url,
          ayat: file.timestamps.map((t) => ({ key: t.verse_key, from: t.timestamp_from, to: t.timestamp_to })),
        },
        { headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=2592000' } }
      )
    }

    if (type === 'visual-page') {
      const verseKey = searchParams.get('verseKey')
      if (!verseKey) {
        return NextResponse.json({ error: 'verseKey parameter required' }, { status: 400 })
      }

      // The local copy is only a fallback, so it is read only if needed — and
      // through the server reader: the browser one hung this request.
      const localPage = async () => (await getVerseByKeyServer(verseKey))?.page_number || 1
      try {
        const page = await fetchVerseVisualPage(verseKey)
        return NextResponse.json({ page: page || (await localPage()) })
      } catch {
        return NextResponse.json({ page: await localPage() })
      }
    }

    if (type === 'visual-pages') {
      const params = new URLSearchParams()
      const chapter = searchParams.get('chapter')
      const juz = searchParams.get('juz')

      if (chapter) {
        params.set('chapter_number', chapter)
      } else if (juz) {
        params.set('juz_number', juz)
      } else {
        return NextResponse.json({ error: 'chapter or juz parameter required' }, { status: 400 })
      }

      const pages = await fetchVisualPages(params)
      return NextResponse.json({ pages })
    }

    return NextResponse.json(
      {
        error:
          'type parameter required (chapters, verse, chapter-verses, juz-verses, page, translations, visual-page, visual-pages)',
      },
      { status: 400 }
    )
  } catch (error) {
    const err = error as Error
    console.error('Ayah fetch error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
