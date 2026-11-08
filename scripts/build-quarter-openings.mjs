/**
 * Builds lib/quarter-openings.json: the opening words of the 240 quarters (rubʿ al-ḥizb),
 * for the Quarters list in Read, so it needs no network and no 16 MB Quran file.
 *
 *   node scripts/build-quarter-openings.mjs
 *
 * For each quarter's first ayah: `p` its printed page (which also names its font), `g` its
 * first words as that page's QCF glyphs, and `t` a few plain words in case the font cannot be had.
 * Only what the list's two lines can show is kept. The Quran does not change, so this is only
 * run again if the list or the data's format does.
 */

import { readFileSync, writeFileSync } from 'node:fs'

/** Two lines of the list at most. */
const GLYPH_WORDS = 22
const PLAIN_WORDS = 12

const { verses } = JSON.parse(readFileSync('public/quran-data.json', 'utf8'))
const starts = JSON.parse(readFileSync('lib/quarter-starts.json', 'utf8'))
const byKey = new Map(verses.map((verse) => [verse.verse_key, verse]))

const wordPage = (word, verse) => word.v2_page || word.page_number || verse.page_number || 0

const openings = {}
for (const key of starts) {
  const verse = byKey.get(key)
  if (!verse) throw new Error(`No verse ${key} in the Quran data`)
  const words = [...verse.words].sort((a, b) => a.position - b.position)
  const page = wordPage(words[0], verse)
  const glyphs = words
    .filter((word) => wordPage(word, verse) === page && word.code_v2?.trim())
    .map((word) => word.code_v2.trim())
    .slice(0, GLYPH_WORDS)
  if (!glyphs.length) throw new Error(`No glyphs for ${key}`)
  const plain = words
    .filter((word) => word.char_type_name !== 'end')
    .map((word) => (word.text_uthmani || word.text_qpc_hafs || '').trim())
    .filter(Boolean)
    .slice(0, PLAIN_WORDS)
    .join(' ')
  openings[key] = { p: page, g: glyphs, t: plain }
}

writeFileSync('lib/quarter-openings.json', JSON.stringify(openings))
console.log(`${Object.keys(openings).length} quarters`)
