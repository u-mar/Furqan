#!/usr/bin/env node

/**
 * Build a high-quality offline Quran bundle:
 * - public/quran-data.json  (QCF code_v2 + line layout for all 604 Madani pages)
 * - public/qcf/p{n}.woff2  (page fonts for offline glyph rendering)
 * - public/fonts/surah-name-v2.ttf
 * - public/offline-manifest.json
 *
 * Usage: node scripts/download-quran-data.js [--skip-fonts] [--fonts-only]
 */

const fs = require('fs')
const path = require('path')
const https = require('https')
const http = require('http')

const QURAN_API_BASE = 'https://api.quran.com/api/v4'
const QCF_FONT_CDN_BASE = 'https://verses.quran.foundation/fonts/quran/hafs/v2/woff2'
const SURAH_NAME_FONT_URL =
  'https://static-cdn.tarteel.ai/qul/fonts/surah-names/v2/surah-name-v2.ttf'
const TOTAL_PAGES = 604
const BUNDLE_VERSION = 2

const WORD_FIELDS =
  'code_v2,text_qpc_hafs,text_uthmani,line_number,v2_page,page_number,char_type_name'

const args = process.argv.slice(2)
const skipFonts = args.includes('--skip-fonts')
const fontsOnly = args.includes('--fonts-only')

function bar(ratio, width = 28) {
  const filled = Math.round(ratio * width)
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

function formatMb(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function fetchBuffer(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http
    lib
      .get(url, { headers: { 'User-Agent': 'Muyassar-Quran-Downloader/2' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          if (redirects > 5) return reject(new Error(`Too many redirects: ${url}`))
          const next = new URL(res.headers.location, url).toString()
          res.resume()
          fetchBuffer(next, redirects + 1).then(resolve, reject)
          return
        }
        if (res.statusCode !== 200) {
          res.resume()
          reject(new Error(`HTTP ${res.statusCode} for ${url}`))
          return
        }
        const chunks = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => resolve(Buffer.concat(chunks)))
      })
      .on('error', reject)
  })
}

async function fetchJson(url, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const buf = await fetchBuffer(url)
      return JSON.parse(buf.toString('utf8'))
    } catch (err) {
      if (attempt === retries - 1) throw err
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)))
    }
  }
}

function normalizeWord(word) {
  if (!word) return null
  const textUthmani = word.text_uthmani || ''
  const isEnd = word.char_type_name === 'end'
  if (!isEnd && !textUthmani.trim() && !word.code_v2 && !word.text_qpc_hafs) return null

  const out = {
    id: word.id,
    verse_key: word.verse_key,
    position: word.position,
    text_uthmani: textUthmani,
    char_type_name: word.char_type_name || 'word',
  }
  if (word.text_qpc_hafs) out.text_qpc_hafs = word.text_qpc_hafs
  if (word.code_v2) out.code_v2 = word.code_v2
  if (word.line_number != null) out.line_number = word.line_number
  if (word.v2_page != null) out.v2_page = word.v2_page
  if (word.page_number != null) out.page_number = word.page_number
  return out
}

function normalizeVerse(verse) {
  const words = (verse.words || []).map(normalizeWord).filter(Boolean)
  return {
    id: verse.id,
    verse_key: verse.verse_key,
    text_uthmani: verse.text_uthmani || '',
    verse_number: verse.verse_number,
    juz_number: verse.juz_number,
    page_number: verse.page_number,
    words,
  }
}

function mergeVerseIntoMap(map, verse) {
  const normalized = normalizeVerse(verse)
  if (!normalized.words.length && !normalized.text_uthmani) return

  const existing = map.get(normalized.verse_key)
  if (!existing) {
    map.set(normalized.verse_key, normalized)
    return
  }

  const byId = new Map(existing.words.map((w) => [w.id, w]))
  for (const w of normalized.words) {
    byId.set(w.id, { ...byId.get(w.id), ...w })
  }
  existing.words = Array.from(byId.values()).sort((a, b) => a.position - b.position)
  if (!existing.text_uthmani && normalized.text_uthmani) {
    existing.text_uthmani = normalized.text_uthmani
  }
}

async function downloadQuranText(publicDir) {
  console.log('\n📖  Downloading Madani mushaf text (604 pages, QCF glyphs)…\n')

  const chaptersData = await fetchJson(`${QURAN_API_BASE}/chapters`)
  const chapters = chaptersData.chapters

  const verseMap = new Map()
  let glyphWords = 0
  let totalWords = 0

  for (let page = 1; page <= TOTAL_PAGES; page += 1) {
    const params = new URLSearchParams({
      words: 'true',
      word_fields: WORD_FIELDS,
      mushaf: '1',
    })
    const url = `${QURAN_API_BASE}/verses/by_page/${page}?${params.toString()}`
    const data = await fetchJson(url)

    for (const verse of data.verses || []) {
      mergeVerseIntoMap(verseMap, verse)
    }

    for (const verse of data.verses || []) {
      for (const w of verse.words || []) {
        totalWords += 1
        if (w.code_v2) glyphWords += 1
      }
    }

    const ratio = page / TOTAL_PAGES
    process.stdout.write(
      `\r  ${bar(ratio)}  Page ${String(page).padStart(3)}/${TOTAL_PAGES}  (${verseMap.size} ayahs)`
    )

    if (page % 8 === 0) await new Promise((r) => setTimeout(r, 120))
  }

  process.stdout.write('\n')

  const verses = Array.from(verseMap.values()).sort((a, b) => {
    const [ac, av] = a.verse_key.split(':').map(Number)
    const [bc, bv] = b.verse_key.split(':').map(Number)
    return ac - bc || av - bv
  })

  let finalGlyphs = 0
  let finalWords = 0
  for (const v of verses) {
    for (const w of v.words || []) {
      finalWords += 1
      if (w.code_v2) finalGlyphs += 1
    }
  }

  const quranData = {
    bundleVersion: BUNDLE_VERSION,
    chapters: chapters.map((c) => ({
      id: c.id,
      name: c.name_arabic || c.name_simple,
      englishName: c.english_name || c.transliterated_name?.name || c.name_simple,
      versesCount: c.verses_count,
    })),
    verses,
  }

  const outputPath = path.join(publicDir, 'quran-data.json')
  fs.writeFileSync(outputPath, JSON.stringify(quranData))

  console.log(`  ✓ Saved ${outputPath}`)
  console.log(`    Size: ${formatMb(fs.statSync(outputPath).size)}`)
  console.log(`    ${chapters.length} surahs · ${verses.length} ayahs`)
  console.log(`    QCF glyphs: ${finalGlyphs.toLocaleString()} / ${finalWords.toLocaleString()} words`)

  if (finalGlyphs < finalWords * 0.5) {
    console.warn('\n  ⚠ Low glyph count — check API fields or network.\n')
  }

  return { outputPath, chapters: chapters.length, verses: verses.length, glyphWords: finalGlyphs }
}

async function downloadFile(url, dest, label) {
  if (fs.existsSync(dest)) {
    const size = fs.statSync(dest).size
    if (size > 500) return { skipped: true, size }
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  const buf = await fetchBuffer(url)
  fs.writeFileSync(dest, buf)
  return { skipped: false, size: buf.length }
}

async function downloadFonts(publicDir) {
  console.log('\n🔤  Downloading mushaf fonts (604 page files + surah names)…\n')

  const qcfDir = path.join(publicDir, 'qcf')
  const surahDest = path.join(publicDir, 'fonts', 'surah-name-v2.ttf')
  fs.mkdirSync(qcfDir, { recursive: true })

  let totalBytes = 0
  let skipped = 0
  let failed = 0

  const surahResult = await downloadFile(SURAH_NAME_FONT_URL, surahDest, 'surah names')
  totalBytes += surahResult.size || 0
  if (surahResult.skipped) skipped += 1
  console.log(`  ✓ Surah name font → fonts/surah-name-v2.ttf`)

  const concurrency = 10
  let nextPage = 1
  let completed = 0

  async function worker() {
    while (nextPage <= TOTAL_PAGES) {
      const page = nextPage
      nextPage += 1
      const dest = path.join(qcfDir, `p${page}.woff2`)
      const url = `${QCF_FONT_CDN_BASE}/p${page}.woff2`

      try {
        const result = await downloadFile(url, dest, `p${page}`)
        totalBytes += result.size || fs.statSync(dest).size
        if (result.skipped) skipped += 1
      } catch {
        failed += 1
      }

      completed += 1
      const ratio = completed / TOTAL_PAGES
      process.stdout.write(
        `\r  ${bar(ratio)}  Font ${String(completed).padStart(3)}/${TOTAL_PAGES}  (${skipped} cached, ${failed} failed)`
      )
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()))
  process.stdout.write('\n')
  console.log(`  ✓ Fonts in public/qcf/ (${formatMb(totalBytes)} total)`)
  if (failed > 0) console.warn(`  ⚠ ${failed} fonts failed — re-run script to retry.\n`)

  return { totalBytes, skipped, failed }
}

async function writeManifest(publicDir, stats) {
  const manifest = {
    version: BUNDLE_VERSION,
    generatedAt: new Date().toISOString(),
    quranData: fs.existsSync(path.join(publicDir, 'quran-data.json')),
    fonts: fs.existsSync(path.join(publicDir, 'fonts', 'qcf', 'p1.woff2')),
    surahNameFont: fs.existsSync(path.join(publicDir, 'fonts', 'surah-name-v2.ttf')),
    ...stats,
  }
  const manifestPath = path.join(publicDir, 'offline-manifest.json')
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
  console.log(`\n📋  Manifest → ${manifestPath}`)
}

async function main() {
  const publicDir = path.join(__dirname, '..', 'public')
  if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true })

  console.log('═══════════════════════════════════════════════')
  console.log('  Muyassar — Offline Quran bundle (QCF v2)')
  console.log('═══════════════════════════════════════════════')

  const stats = {}

  if (!fontsOnly) {
    const textStats = await downloadQuranText(publicDir)
    stats.verses = textStats.verses
    stats.chapters = textStats.chapters
    stats.glyphWords = textStats.glyphWords
  }

  if (!skipFonts) {
    const fontStats = await downloadFonts(publicDir)
    stats.fonts = fontStats
  }

  await writeManifest(publicDir, stats)

  console.log('\n✅  Done. In the app: Settings → Download for offline')
  console.log('    (or deploy public/ so users get the new bundle.)\n')
}

main().catch((err) => {
  console.error('\n❌  Download failed:', err.message)
  process.exit(1)
})
