import { NextRequest, NextResponse } from 'next/server'
import { getVerseByKeyServer, getVersesByPageServer } from '@/lib/quran-server'
import { DEFAULT_TRANSLATION_EDITION, isTranslationEditionId } from '@/lib/translations'
import { API_TIMEOUT_MS, QURAN_API_BASE, fetchTranslationsForPage } from '@/lib/translations-server'
import { PartRequestError, partTranslationFor, phraseTranslationsFor } from '@/lib/part-translation-store'
import type { Verse } from '@/types'
import hadiToureTimings from '@/lib/reciter-timings/hadi_toure.json'


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

/**
 * The AI's answers do not change, so they are kept a month, by the phone and by
 * the CDN (s-maxage) alike. A stand-in is not kept: the next request should get
 * the AI's answer instead.
 */
function aiCacheHeaders(source: string) {
  return { 'Cache-Control': source === 'ai' ? 'public, max-age=2592000, s-maxage=2592000' : 'no-store' }
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
      try {
        const part = await partTranslationFor(verseKey, edition, start, end)
        if (!part) return NextResponse.json({ text: null, source: null })
        return NextResponse.json(part, { headers: aiCacheHeaders(part.source) })
      } catch (err) {
        if (err instanceof PartRequestError) return NextResponse.json({ error: err.message }, { status: err.status })
        throw err
      }
    }

    // An ayah shown a phrase at a time (the Qari video view): every phrase's translation in one go.
    // Without `phrases`, the ayah is cut where the mushaf pauses, as the app cuts it.
    if (type === 'phrase-translations') {
      const verseKey = searchParams.get('verse') ?? ''
      const edition = searchParams.get('edition') ?? ''
      const listed = searchParams.get('phrases')
      if (!/^\d{1,3}:\d{1,3}$/.test(verseKey) || !isTranslationEditionId(edition) || (listed !== null && !/^\d+-\d+(,\d+-\d+){1,39}$/.test(listed))) {
        return NextResponse.json({ error: 'verse and edition required; phrases as start-end,start-end…' }, { status: 400 })
      }
      const phrases = listed?.split(',').map((pair) => {
        const [start, end] = pair.split('-').map(Number)
        return { start, end }
      })
      try {
        const translated = await phraseTranslationsFor(verseKey, edition, phrases)
        if (!translated) return NextResponse.json({ texts: null, source: null })
        return NextResponse.json(translated, { headers: aiCacheHeaders(translated.source) })
      } catch (err) {
        if (err instanceof PartRequestError) return NextResponse.json({ error: err.message }, { status: err.status })
        throw err
      }
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
