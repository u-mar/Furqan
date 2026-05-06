#!/usr/bin/env node

/**
 * Download Quran data from api.quran.com and bundle it for offline use.
 * Run this once to generate public/quran-data.json
 */

const fs = require('fs')
const path = require('path')
const https = require('https')

const QURAN_API_BASE = 'https://api.quran.com/api/v4'

function fetchHttps(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          resolve(JSON.parse(data))
        } catch (err) {
          reject(err)
        }
      })
    }).on('error', reject)
  })
}

async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fetchHttps(url)
    } catch (err) {
      if (i === retries - 1) throw err
      console.log(`  Retry ${i + 1}/${retries} for ${url}...`)
      await new Promise(r => setTimeout(r, 2000))
    }
  }
}

async function downloadQuranData() {
  console.log('Downloading Quran data from api.quran.com...')

  // Fetch all chapters
  console.log('Fetching chapters...')
  const chaptersData = await fetchWithRetry(`${QURAN_API_BASE}/chapters`)
  const chapters = chaptersData.chapters

  console.log(`Found ${chapters.length} chapters`)

  const allVerses = []

  // Fetch verses for each chapter
  for (const chapter of chapters) {
    console.log(`  Fetching Surah ${chapter.id}: ${chapter.name_simple}...`)

    let page = 1
    let hasNext = true

    while (hasNext) {
      const url = `${QURAN_API_BASE}/verses/by_chapter/${chapter.id}?words=true&word_fields=text_uthmani,text_qpc_hafs,code_v2,line_number,v2_page&per_page=50&page=${page}&mushaf=1`
      const data = await fetchWithRetry(url)

      if (data.verses && data.verses.length > 0) {
        allVerses.push(...data.verses)
      }

      const pagination = data.pagination
      if (pagination?.next_page) {
        page = pagination.next_page
      } else if (pagination?.current_page && pagination?.total_pages && pagination.current_page < pagination.total_pages) {
        page += 1
      } else {
        hasNext = false
      }
    }

    console.log(`    Downloaded ${allVerses.filter(v => v.verse_key.startsWith(`${chapter.id}:`)).length} verses`)
  }

  console.log(`\nTotal verses downloaded: ${allVerses.length}`)

  // Build the bundled data structure
  const quranData = {
    chapters: chapters.map(c => ({
      id: c.id,
      name: c.name_arabic || c.name_simple,
      englishName: c.english_name || c.transliterated_name?.name || c.name_simple,
      versesCount: c.verses_count
    })),
    verses: allVerses
  }

  // Write to public directory
  const publicDir = path.join(__dirname, '..', 'public')
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true })
  }

  const outputPath = path.join(publicDir, 'quran-data.json')
  fs.writeFileSync(outputPath, JSON.stringify(quranData, null, 2))

  const fileSize = (fs.statSync(outputPath).size / 1024 / 1024).toFixed(2)
  console.log(`\n✓ Quran data saved to ${outputPath}`)
  console.log(`  File size: ${fileSize} MB`)
  console.log(`  ${chapters.length} chapters, ${allVerses.length} verses`)
}

downloadQuranData().catch(err => {
  console.error('Error downloading Quran data:', err)
  process.exit(1)
})
