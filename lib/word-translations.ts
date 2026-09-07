/**
 * Word-by-word glosses for a single ayah, used when someone shares only part
 * of a verse — the bundled Quran data carries Arabic and layout only, so these
 * come from the Quran.com API and need a connection.
 *
 * Word positions line up 1:1 with `words[]` in our own data (verified against
 * the bundled file), so a gloss can be matched to a picked word by index.
 */

const WORD_TRANSLATION_ENDPOINT = 'https://api.quran.com/api/v4/verses/by_key'

interface QuranComWord {
  char_type_name?: string
  translation?: { text?: string | null } | null
}

const cache = new Map<string, string[]>()
const inFlight = new Map<string, Promise<string[] | null>>()

function cacheKey(verseKey: string, language: string): string {
  return `${language}:${verseKey}`
}

/**
 * Glosses for each content word of the ayah, in reading order.
 * Returns null when unavailable (offline, or no word data for the language).
 */
export async function getWordTranslations(
  verseKey: string,
  language = 'en'
): Promise<string[] | null> {
  const key = cacheKey(verseKey, language)
  const cached = cache.get(key)
  if (cached) return cached

  const pending = inFlight.get(key)
  if (pending) return pending

  const request = (async (): Promise<string[] | null> => {
    try {
      const url = `${WORD_TRANSLATION_ENDPOINT}/${encodeURIComponent(
        verseKey
      )}?words=true&word_translation_language=${encodeURIComponent(language)}`
      const res = await fetch(url, { headers: { Accept: 'application/json' } })
      if (!res.ok) return null

      const data = (await res.json()) as { verse?: { words?: QuranComWord[] } }
      const words = (data.verse?.words || []).filter((w) => w.char_type_name === 'word')
      const glosses = words.map((w) => (w.translation?.text || '').trim())

      // All blank means this language has no word-level data — treat as absent.
      if (glosses.length === 0 || glosses.every((g) => !g)) return null

      cache.set(key, glosses)
      return glosses
    } catch {
      return null
    } finally {
      inFlight.delete(key)
    }
  })()

  inFlight.set(key, request)
  return request
}
