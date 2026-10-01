/**
 * The translation of part of an ayah, for sharing a few words of it.
 *
 * Joining the meanings of the chosen words one by one reads like a word list
 * and loses what they mean together. Instead the answer is always taken from
 * the published translation of the whole ayah — the translator's own words,
 * in their own order — cut down to the part that carries the chosen Arabic:
 *
 *   ai       an AI model reads the whole ayah and its translation and picks
 *            out the part; what it returns is checked against the translation
 *            word for word, and thrown away if it strays from it
 *   matched  without the model, the word meanings are lined up against the
 *            translation and the stretch they cover is cut out
 *   words    the word meanings joined, when neither of those finds anything
 *
 * Server only: the model is reached with HF_API_TOKEN (a Hugging Face token
 * allowed to call Inference Providers). PART_TRANSLATION_MODEL picks the model.
 */

export type PartTranslationSource = 'ai' | 'matched' | 'words'

export interface PartTranslation {
  text: string
  source: PartTranslationSource
}

export interface PartTranslationRequest {
  /** The ayah's words in reading order, ayah-end mark left out. */
  arabicWords: string[]
  /** The meaning of each of those words in the translation's language, or null when there are none. */
  glosses: string[] | null
  /** The published translation of the whole ayah. */
  translation: string
  /** First and last chosen word, counted from 0. */
  start: number
  end: number
  /** The translation's language code, e.g. "en", and its name, e.g. "English". */
  language: string
  languageName: string
}

export async function translatePart(request: PartTranslationRequest): Promise<PartTranslation | null> {
  const ai = await pickWithModel(request).catch(() => null)
  if (ai) return { text: ai, source: 'ai' }
  const matched = matchAgainstTranslation(request)
  if (matched) return { text: matched, source: 'matched' }
  const words = request.glosses?.slice(request.start, request.end + 1).filter(Boolean).join(' ').trim()
  return words ? { text: words, source: 'words' } : null
}

/* ------------------------------------------------------------------ words */

interface Token {
  norm: string
  start: number
  end: number
}

function normalize(word: string): string {
  return word
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[’'`]/g, '')
}

function tokenize(text: string): Token[] {
  return [...text.matchAll(/[\p{L}\p{N}’'`-]+/gu)].map((m) => ({
    norm: normalize(m[0]),
    start: m.index ?? 0,
    end: (m.index ?? 0) + m[0].length,
  }))
}

/** Words too common to say which Arabic word they translate. */
const FILLER: Record<string, Set<string>> = {
  en: new Set([
    'the', 'a', 'an', 'of', 'to', 'in', 'and', 'or', 'is', 'are', 'was', 'were', 'be', 'been', 'by', 'for',
    'with', 'that', 'this', 'it', 'its', 'on', 'at', 'as', 'from', 'so', 'then', 'who', 'which', 'what',
    'will', 'shall', 'has', 'have', 'had', 'do', 'did', 'does', 'i', 'e', 'ie', 'indeed', 'verily',
    'he', 'him', 'his', 'she', 'her', 'they', 'them', 'their', 'we', 'us', 'our', 'you', 'your', 'me', 'my',
  ]),
  ur: new Set(['کے', 'کی', 'کا', 'نے', 'کو', 'سے', 'میں', 'اور', 'ہے', 'ہیں', 'وہ', 'یہ', 'جو', 'پر', 'بھی', 'تو', 'ہی', 'تھا', 'تھے']),
}

function isFiller(token: Token, language: string): boolean {
  const list = FILLER[language]
  if (list) return list.has(token.norm) || token.norm.length < 2
  return token.norm.length < 3
}

/** The same word, allowing for an ending: "remember" and "remembrance", "believer" and "believers". */
function sameWord(a: string, b: string): boolean {
  if (a === b) return true
  const shorter = Math.min(a.length, b.length)
  // Close in length too, so "ever" is not taken for "ever-living".
  if (shorter < 4 || shorter / Math.max(a.length, b.length) < 0.7) return false
  const stem = (w: string) => w.slice(0, Math.max(4, w.length - 2))
  return a.startsWith(stem(b)) || b.startsWith(stem(a))
}

/** Small words that open a phrase and belong with it: "Neither slumber…", "but…". */
const LEAD_IN: Record<string, Set<string>> = {
  en: new Set(['neither', 'nor', 'not', 'no', 'nay', 'but', 'yet', 'unquestionably', 'surely', 'truly', 'lo']),
}

/** Every word of `part` (ignoring "…") appears in `whole`, in the same order. */
function isDrawnFrom(part: string, whole: string): boolean {
  const wanted = tokenize(part.replace(/…|\.\.\./g, ' '))
  if (wanted.length === 0) return false
  const pool = tokenize(whole)
  let at = 0
  for (const word of wanted) {
    while (at < pool.length && pool[at].norm !== word.norm) at += 1
    if (at === pool.length) return false
    at += 1
  }
  return true
}

/** Drops a bracket left open or closed by the cut, and any loose punctuation at the edges. */
function tidy(text: string, endsAyah: boolean): string {
  let out = text.trim()
  for (const [open, close] of [
    ['[', ']'],
    ['(', ')'],
  ] as const) {
    let depth = 0
    let kept = ''
    for (const ch of out) {
      if (ch === open) depth += 1
      if (ch === close) {
        if (depth === 0) continue
        depth -= 1
      }
      kept += ch
    }
    // An opening bracket the part never closes.
    for (; depth > 0; depth -= 1) {
      const at = kept.lastIndexOf(open)
      kept = kept.slice(0, at) + kept.slice(at + 1)
    }
    out = kept
  }
  // A quotation mark the part opens or closes but does not pair.
  if ((out.match(/"/g) ?? []).length % 2 === 1) out = out.replace(/"(?=[^"]*$)/, '')
  if ((out.match(/“/g) ?? []).length !== (out.match(/”/g) ?? []).length) out = out.replace(/[“”]/g, '')
  out = out.replace(/^[\s,;:—–\-"“”'’.]+/u, '')
  out = endsAyah ? out : out.replace(/[\s,;:—–\-"“]+$/u, '')
  out = out.replace(/\s+/g, ' ').trim()
  return out ? out.charAt(0).toLocaleUpperCase() + out.slice(1) : out
}

/* ------------------------------------------------------------------ model */

const MODEL_URL = 'https://router.huggingface.co/v1/chat/completions'
const MODEL = process.env.PART_TRANSLATION_MODEL?.trim() || 'Qwen/Qwen2.5-72B-Instruct'
const MODEL_TIMEOUT_MS = 12_000

/** After the model refuses the token, it is left alone for a while rather than asked again for every share. */
let modelOffUntil = 0

function modelToken(): string | null {
  const token = process.env.HF_API_TOKEN?.trim().replace(/^["']|["']$/g, '')
  return token || null
}

async function pickWithModel(request: PartTranslationRequest): Promise<string | null> {
  const token = modelToken()
  if (!token || Date.now() < modelOffUntil) return null

  const { arabicWords, translation, start, end, languageName } = request
  const numbered = arabicWords.map((word, i) => `${i + 1} ${word}`).join('  ')
  const chosen = arabicWords.slice(start, end + 1).join(' ')

  const res = await fetch(MODEL_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
    body: JSON.stringify({
      model: MODEL,
      temperature: 0,
      max_tokens: 300,
      messages: [
        {
          role: 'system',
          content:
            'You align the Quran with its published translations. You understand Classical Arabic and read each ayah as a whole before deciding which words of a translation carry which part of it. You never invent, paraphrase or explain wording.',
        },
        {
          role: 'user',
          content: [
            `Ayah, word by word: ${numbered}`,
            `Published ${languageName} translation of the whole ayah: "${translation}"`,
            `Chosen Arabic words ${start + 1}–${end + 1}: ${chosen}`,
            '',
            'Give the part of the published translation that says what the chosen words say, understood in the context of the whole ayah.',
            "- Copy the translator's own words, in their order. Do not reword, add to or explain them.",
            '- Leave out what only translates Arabic words outside the choice.',
            '- Keep the small words the phrase needs to read naturally.',
            '- If that meaning sits in two separate places in the translation, join them with " … ".',
            'Reply with JSON only: {"text": "..."}',
          ].join('\n'),
        },
      ],
    }),
  })

  if (res.status === 401 || res.status === 403) {
    modelOffUntil = Date.now() + 10 * 60_000
    return null
  }
  if (!res.ok) return null

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
  const content = data.choices?.[0]?.message?.content ?? ''
  const json = content.match(/\{[\s\S]*\}/)?.[0]
  if (!json) return null
  const text = (JSON.parse(json) as { text?: unknown }).text
  if (typeof text !== 'string' || !text.trim()) return null

  // Only the translator's words count; anything the model wrote itself is refused.
  if (!isDrawnFrom(text, translation)) return null
  return tidy(text, end === arabicWords.length - 1)
}

/* ------------------------------------------------------------------ matching */

/** How far past the matched words a part may reach to finish its phrase, in words. */
const REACH = 3

/**
 * The stretch of the translation that holds a match for every one of these
 * word lists, as tight as possible — and, between equally tight ones, the one
 * lying where the chosen words lie in the ayah, so a word that appears twice
 * ("Allah", "hearts") is taken from the right place. Words that mean the same
 * (the two "Allah"s of "Allah teaches you. And Allah…") need as many matches.
 */
function tightestSpan(lists: number[][], expected: number): { lo: number; hi: number } | null {
  const groups = new Map<string, { places: number[]; need: number }>()
  for (const places of lists) {
    const key = places.join(',')
    const group = groups.get(key)
    if (group) group.need += 1
    else groups.set(key, { places, need: 1 })
  }
  const required = [...groups.values()]
  if (required.some((g) => g.places.length < g.need)) {
    // Fewer places than words: each is satisfied by what there is.
    for (const g of required) g.need = Math.min(g.need, g.places.length)
  }
  const events = required.flatMap((g, w) => g.places.map((p) => ({ p, w }))).sort((a, b) => a.p - b.p)
  const seen = new Array<number>(required.length).fill(0)
  let satisfied = 0
  let left = 0
  let best: { lo: number; hi: number; cost: number } | null = null
  for (const event of events) {
    if (++seen[event.w] === required[event.w].need) satisfied += 1
    while (satisfied === required.length) {
      const lo = events[left].p
      const cost = event.p - lo + 0.8 * Math.abs((lo + event.p) / 2 - expected)
      if (!best || cost < best.cost) best = { lo, hi: event.p, cost }
      if (seen[events[left].w]-- === required[events[left].w].need) satisfied -= 1
      left += 1
    }
  }
  return best ? { lo: best.lo, hi: best.hi } : null
}

/**
 * Lines the chosen words' meanings up against the translation and cuts out
 * the stretch they cover, finished off to the edges of its phrase — never over
 * a word that translates an Arabic word outside the choice, and never into
 * another sentence — reaching to the start or end of the translation when the
 * choice starts or ends the ayah.
 */
function matchAgainstTranslation(request: PartTranslationRequest): string | null {
  const { glosses, translation, start, end, arabicWords, language } = request
  if (!glosses || glosses.length !== arabicWords.length) return null
  const text = tokenize(translation)
  if (text.length === 0) return null

  const leadIns = LEAD_IN[language]
  const placesOf = (i: number): number[] | null => {
    // "not", "no" and the like are worded too many ways to look for; they come back in with their phrase.
    const meaning = tokenize(glosses[i] ?? '').filter((t) => !isFiller(t, language) && !leadIns?.has(t.norm))
    if (meaning.length === 0) return null
    const places: number[] = []
    text.forEach((t, j) => {
      if (!isFiller(t, language) && meaning.some((m) => sameWord(m.norm, t.norm))) places.push(j)
    })
    return places
  }

  // Where in the translation each chosen word's meaning appears, and which words belong to the rest.
  const lists: number[][] = []
  let meaningful = 0
  const others = new Set<number>()
  for (let i = 0; i < arabicWords.length; i += 1) {
    const places = placesOf(i)
    if (places === null) continue
    if (i >= start && i <= end) {
      meaningful += 1
      if (places.length) lists.push(places)
    } else {
      for (const p of places) others.add(p)
    }
  }
  if (meaningful === 0 || lists.length / meaningful < 0.5) return null

  const expected = (((start + end) / 2 + 0.5) / arabicWords.length) * text.length
  let span = tightestSpan(lists, expected)
  if (!span) return null
  // One stray match can stretch the part across the ayah; without it, if most still match, it is left out.
  const chosenCount = end - start + 1
  if (span.hi - span.lo + 1 > chosenCount * 3 + 4 && lists.length > 1) {
    for (let drop = 0; drop < lists.length; drop += 1) {
      const rest = lists.filter((_, i) => i !== drop)
      if (rest.length / meaningful < 0.5) continue
      const narrower = tightestSpan(rest, expected)
      if (narrower && narrower.hi - narrower.lo < span.hi - span.lo) span = narrower
    }
  }
  let { lo, hi } = span

  const gap = (a: number, b: number) => translation.slice(text[a].end, text[b].start)
  const pauseBetween = (a: number, b: number) => /[,;:.!?]/.test(gap(a, b))
  const sentenceBetween = (a: number, b: number) => /[.!?]/.test(gap(a, b))

  if (start === 0) {
    // To the start of the ayah, but not back into an earlier sentence.
    while (lo > 0 && !sentenceBetween(lo - 1, lo)) lo -= 1
  } else {
    // Back over the small words that open the phrase: "by the remembrance…", "Neither slumber…".
    for (
      let steps = 0;
      steps < REACH &&
      lo > 0 &&
      !others.has(lo - 1) &&
      !pauseBetween(lo - 1, lo) &&
      (isFiller(text[lo - 1], language) || Boolean(leadIns?.has(text[lo - 1].norm)));
      steps += 1
    ) {
      lo -= 1
    }
  }
  if (end === arabicWords.length - 1) {
    // To the end of the ayah, but not on into a later sentence.
    while (hi < text.length - 1 && !sentenceBetween(hi, hi + 1)) hi += 1
  } else {
    // On to the end of the phrase: "the Sustainer of [all] existence".
    for (let steps = 0; steps < REACH && hi < text.length - 1 && !others.has(hi + 1) && !pauseBetween(hi, hi + 1); steps += 1) {
      hi += 1
    }
  }

  // A full stop or the like that closes the part comes with it.
  const closing = translation.slice(text[hi].end).match(/^\S*?[.!?]["”’)\]]*/)?.[0] ?? ''
  const part = tidy(translation.slice(text[lo].start, text[hi].end + closing.length), Boolean(closing))
  return part || null
}
