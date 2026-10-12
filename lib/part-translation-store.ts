/**
 * The AI's cuts of the published translations — part of an ayah for the share
 * picture, an ayah's phrases for the Qari video view — worked out once and
 * kept: in memory, and in the database (AiTranslation), so every server and
 * every viewer after the first has them at once without asking the model.
 *
 * A recitation's phrases are worked out as it is published
 * (warmRecitationCaptions), so not even its first viewer waits for the model.
 *
 * Server only. How the model is asked is in lib/part-translation.ts.
 */

import { prisma } from '@/lib/prisma'
import { getVerseByKeyServer } from '@/lib/quran-server'
import { translatePart, translatePhrases, type PartTranslation, type PhraseTranslations } from '@/lib/part-translation'
import { ayahParts, type AyahPart } from '@/lib/qari-ayah-parts'
import { API_TIMEOUT_MS, QURAN_API_BASE, fetchTranslationsForPage } from '@/lib/translations-server'
import { DEFAULT_TRANSLATION_EDITION, languageForEdition, translationLanguageLabel } from '@/lib/translations'

/** A request that cannot be answered as asked, with the HTTP status that says why. */
export class PartRequestError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message)
  }
}

/* ------------------------------------------------------------------ kept answers */

/**
 * Part of every key. Raised when the way answers are worked out changes enough
 * that the ones kept should be worked out again.
 */
const STORE_VERSION = 1
const MEMORY_LIMIT = 2000
const memory = new Map<string, string[]>()

function keepInMemory(key: string, texts: string[]) {
  if (memory.size >= MEMORY_LIMIT) memory.delete(memory.keys().next().value as string)
  memory.set(key, texts)
}

async function recall(key: string): Promise<string[] | null> {
  const known = memory.get(key)
  if (known) return known
  try {
    const row = await prisma.aiTranslation.findUnique({ where: { key }, select: { texts: true } })
    if (row) {
      keepInMemory(key, row.texts)
      return row.texts
    }
  } catch {
    // The database is out of reach: the model can still answer.
  }
  return null
}

async function keep(key: string, texts: string[]) {
  keepInMemory(key, texts)
  try {
    await prisma.aiTranslation.upsert({ where: { key }, create: { key, texts }, update: { texts } })
  } catch {
    // Kept in this server's memory at least; worked out again elsewhere.
  }
}

/* ------------------------------------------------------------------ the ayah */

/** The mushaf's pause marks (waqf signs), as lib/qari-ayah.ts reads them. */
const PAUSE_MARK = /[ۖ-ۜ]/

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

/**
 * What a part of an ayah is cut from: its words, counted as the share page and
 * the Qari video view count them, where the mushaf pauses, and the whole
 * translation. Null when the edition has no translation of it.
 */
async function ayahForParts(verseKey: string, edition: string) {
  const verse = await getVerseByKeyServer(verseKey)
  if (!verse) throw new PartRequestError(404, 'Verse not found')
  const words = (verse.words ?? []).filter(
    (w) => w.char_type_name === 'word' && (w.text_uthmani || w.text_qpc_hafs || '').trim()
  )
  const rows = verse.page_number ? await fetchTranslationsForPage(verse.page_number, edition) : []
  const translation = rows.find((r) => r.verse_key === verseKey)?.translation?.trim()
  if (!translation) return null
  const language = languageForEdition(edition)
  return {
    pauseAfter: words.map((w) => PAUSE_MARK.test(w.text_uthmani || '')),
    request: {
      arabicWords: words.map((w) => (w.text_uthmani || w.text_qpc_hafs || '').trim()),
      glosses: await wordMeanings(verseKey, words.length, language),
      translation,
      language,
      languageName: translationLanguageLabel(language),
    },
  }
}

/* ------------------------------------------------------------------ answers */

/** The translation of words `start`–`end` of an ayah, for the share picture. */
export async function partTranslationFor(
  verseKey: string,
  edition: string,
  start: number,
  end: number
): Promise<PartTranslation | null> {
  const key = `v${STORE_VERSION}|part|${edition}|${verseKey}|${start}-${end}`
  const kept = await recall(key)
  if (kept?.[0]) return { text: kept[0], source: 'ai' }

  const ayah = await ayahForParts(verseKey, edition)
  if (!ayah) return null
  if (start < 0 || end < start || end >= ayah.request.arabicWords.length) {
    throw new PartRequestError(400, 'start and end must be within the ayah')
  }
  const part = await translatePart({ ...ayah.request, start, end })
  if (part?.source === 'ai') await keep(key, [part.text])
  return part
}

export interface PhrasesAnswer extends PhraseTranslations {
  phrases: AyahPart[]
}

const phrasesKey = (verseKey: string, edition: string, phrases: AyahPart[]) =>
  `v${STORE_VERSION}|phrases|${edition}|${verseKey}|${phrases.map((p) => `${p.start}-${p.end}`).join(',')}`

/**
 * Each phrase of an ayah with its share of the translation. `phrases` are the
 * ones the app shows; without them the ayah is cut where the mushaf pauses,
 * the way the app cuts it. Null for an ayah of one phrase, or with no translation.
 */
export async function phraseTranslationsFor(
  verseKey: string,
  edition: string,
  phrases?: AyahPart[]
): Promise<PhrasesAnswer | null> {
  if (phrases) {
    const kept = await recall(phrasesKey(verseKey, edition, phrases))
    if (kept) return { phrases, texts: kept, source: 'ai' }
  }

  const ayah = await ayahForParts(verseKey, edition)
  if (!ayah) return null
  const shown = phrases ?? ayahParts(ayah.pauseAfter)
  if (shown.length < 2) return null
  if (!phrases) {
    const kept = await recall(phrasesKey(verseKey, edition, shown))
    if (kept) return { phrases: shown, texts: kept, source: 'ai' }
  }
  // The whole ayah, in order, without gaps or overlaps: the translation is divided among them.
  const words = ayah.request.arabicWords.length
  if (shown.some((p, k) => p.end < p.start || p.start !== (k === 0 ? 0 : shown[k - 1].end + 1)) || shown[shown.length - 1].end !== words - 1) {
    throw new PartRequestError(400, 'phrases must cover the ayah in order')
  }

  const translated = await translatePhrases({ ...ayah.request, phrases: shown })
  if (!translated) return null
  const { texts } = translated
  if (translated.source === 'ai' && texts.every((t): t is string => typeof t === 'string')) {
    await keep(phrasesKey(verseKey, edition, shown), texts)
  }
  return { phrases: shown, ...translated }
}

/* ------------------------------------------------------------------ publishing */

/**
 * The editions most viewers watch in: the app's default English, and Somali.
 * A viewer reading another works it out once, on first view, for everyone after.
 */
const WARM_EDITIONS = [DEFAULT_TRANSLATION_EDITION.en, DEFAULT_TRANSLATION_EDITION.so].filter(Boolean)

/**
 * Works out the phrases of every ayah of a newly published recitation, so they
 * are ready before anyone watches it. One ayah after another, so the model's
 * free tier is not asked for everything at once.
 */
export async function warmRecitationCaptions(verseKeys: string[]): Promise<void> {
  for (const verseKey of new Set(verseKeys)) {
    for (const edition of WARM_EDITIONS) {
      try {
        await phraseTranslationsFor(verseKey, edition)
      } catch {
        // That ayah is worked out when it is first watched instead.
      }
    }
  }
}
