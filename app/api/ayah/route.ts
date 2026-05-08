import { NextRequest, NextResponse } from 'next/server'
import {
  getChapters,
  getVerseByKey,
  getVersesByChapter,
  getVersesByJuz,
  getVersesByPage,
} from '@/lib/quran'
import type { Verse } from '@/types'

const QURAN_API_BASE = process.env.QURAN_API_BASE || 'https://api.quran.com/api/v4'

async function fetchQcfPage(page: number): Promise<Verse[]> {
  const params = new URLSearchParams({
    words: 'true',
    word_fields: 'code_v2,text_qpc_hafs,text_uthmani,line_number,v2_page,page_number,char_type_name',
    mushaf: '1',
  })
  const response = await fetch(`${QURAN_API_BASE}/verses/by_page/${page}?${params.toString()}`, {
    next: { revalidate: 60 * 60 * 24 * 30 },
  })

  if (!response.ok) {
    throw new Error(`Quran API page fetch failed: ${response.statusText}`)
  }

  const data = (await response.json()) as { verses?: Verse[] }
  return data.verses || []
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
  })

  if (!response.ok) {
    throw new Error(`Quran API visual pages fetch failed: ${response.statusText}`)
  }

  const data = (await response.json()) as { verses?: Array<{ verse_key: string; v2_page?: number }> }
  return Object.fromEntries((data.verses || []).map((verse) => [verse.verse_key, verse.v2_page || 1]))
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get('type')

    if (type === 'chapters') {
      const chapters = await getChapters()
      return NextResponse.json(chapters)
    }

    if (type === 'verse') {
      const verseKey = searchParams.get('verseKey')
      if (!verseKey) {
        return NextResponse.json({ error: 'verseKey parameter required' }, { status: 400 })
      }
      const verse = await getVerseByKey(verseKey)
      return NextResponse.json(verse)
    }

    if (type === 'chapter-verses') {
      const chapter = Number(searchParams.get('chapter'))
      if (!chapter || chapter < 1) {
        return NextResponse.json({ error: 'chapter parameter required' }, { status: 400 })
      }
      const verses = await getVersesByChapter(chapter)
      return NextResponse.json(verses)
    }

    if (type === 'juz-verses') {
      const juz = Number(searchParams.get('juz'))
      if (!juz || juz < 1 || juz > 30) {
        return NextResponse.json({ error: 'valid juz parameter (1-30) required' }, { status: 400 })
      }
      const verses = await getVersesByJuz(juz)
      return NextResponse.json(verses)
    }

    if (type === 'page') {
      const page = Number(searchParams.get('page'))
      if (!page || page < 1 || page > 604) {
        return NextResponse.json({ error: 'valid page parameter (1-604) required' }, { status: 400 })
      }

      try {
        const verses = await fetchVisualQcfPage(page)
        return NextResponse.json(verses)
      } catch {
        const verses = await getVersesByPage(page)
        return NextResponse.json(verses)
      }
    }

    if (type === 'visual-page') {
      const verseKey = searchParams.get('verseKey')
      if (!verseKey) {
        return NextResponse.json({ error: 'verseKey parameter required' }, { status: 400 })
      }

      const fallbackVerse = await getVerseByKey(verseKey)
      try {
        const page = await fetchVerseVisualPage(verseKey)
        return NextResponse.json({ page: page || fallbackVerse.page_number || 1 })
      } catch {
        return NextResponse.json({ page: fallbackVerse.page_number || 1 })
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
      { error: 'type parameter required (chapters, verse, chapter-verses, juz-verses, page, visual-page, visual-pages)' },
      { status: 400 }
    )
  } catch (error) {
    const err = error as Error
    console.error('Ayah fetch error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
