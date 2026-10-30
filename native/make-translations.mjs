// Writes the translations the Play Store app carries inside it (android/…/BundledQuran.java):
// native/quran/translations/<edition>.json, every mushaf page's rows keyed by page number, exactly
// as /api/ayah gives them. Run with the dev server up:  node native/make-translations.mjs
import { mkdirSync, writeFileSync } from 'node:fs'

const SITE = process.env.SITE || 'http://localhost:3000'
const EDITIONS = [
  ['en.sahih', 'en'],
  ['so.abduh', 'so'],
]
const PAGES = 604

async function page(edition, lang, n) {
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const res = await fetch(`${SITE}/api/ayah?type=translations&page=${n}&lang=${lang}&edition=${edition}`)
      const rows = await res.json()
      if (res.ok && Array.isArray(rows) && rows.length > 0 && rows.every((r) => r.translation)) return rows
    } catch {
      // Tried again below.
    }
    await new Promise((r) => setTimeout(r, 1000 * attempt))
  }
  throw new Error(`${edition}: page ${n} would not load`)
}

mkdirSync(new URL('./quran/translations/', import.meta.url), { recursive: true })
for (const [edition, lang] of EDITIONS) {
  const pages = {}
  for (let start = 1; start <= PAGES; start += 6) {
    const batch = Array.from({ length: Math.min(6, PAGES - start + 1) }, (_, i) => start + i)
    const results = await Promise.all(batch.map((n) => page(edition, lang, n)))
    batch.forEach((n, i) => (pages[n] = results[i]))
  }
  const ayat = Object.values(pages).reduce((sum, rows) => sum + rows.length, 0)
  writeFileSync(new URL(`./quran/translations/${edition}.json`, import.meta.url), JSON.stringify(pages))
  console.log(`${edition}: ${Object.keys(pages).length} pages, ${ayat} ayat`)
}
