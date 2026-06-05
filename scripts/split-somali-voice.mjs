#!/usr/bin/env node
/**
 * Split one Somali voice recording into per-ayah MP3s using ffmpeg.
 *
 * Usage:
 *   node scripts/split-somali-voice.mjs \
 *     --input path/to/recording.mp3 \
 *     --json path/to/timestamps.json \
 *     --output public/data/somali-voice/audio/per-ayah \
 *     --ffmpeg "C:/path/to/ffmpeg.exe"
 *
 * JSON formats supported:
 *   A) { "timestamps": [{ "key": "19:22", "start": 0, "end": 12.5 }, ...] }
 *   B) { "chunks": [{ "ayahs": [...] }] }  (uses first chunk)
 *
 * Times are in seconds unless --time-format m.ss is passed.
 */

import { spawnSync } from 'node:child_process'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

function parseArgs(argv) {
  const opts = {
    input: '',
    json: '',
    output: 'public/data/somali-voice/audio/per-ayah',
    ffmpeg: 'ffmpeg',
    timeFormat: 'seconds',
    manifestOut: '',
    filePrefix: '',
  }

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i]
    const next = argv[i + 1]
    if (arg === '--input' && next) {
      opts.input = next
      i++
    } else if (arg === '--json' && next) {
      opts.json = next
      i++
    } else if (arg === '--output' && next) {
      opts.output = next
      i++
    } else if (arg === '--ffmpeg' && next) {
      opts.ffmpeg = next
      i++
    } else if (arg === '--time-format' && next) {
      opts.timeFormat = next
      i++
    } else if (arg === '--manifest-out' && next) {
      opts.manifestOut = next
      i++
    } else if (arg === '--file-prefix' && next) {
      opts.filePrefix = next.replace(/\/?$/, '/')
      i++
    } else if (arg === '--help' || arg === '-h') {
      console.log(`Split Somali voice recording into per-ayah MP3s.

Options:
  --input         Source MP3 (required)
  --json          Timestamps JSON (required)
  --output        Output folder (default: public/data/somali-voice/audio/per-ayah)
  --ffmpeg        ffmpeg executable (default: ffmpeg)
  --time-format   seconds | m.ss (default: seconds)
  --manifest-out  Write manifest chunk JSON to this path (optional)
`)
      process.exit(0)
    }
  }

  if (!opts.input || !opts.json) {
    console.error('Error: --input and --json are required. Run with --help for usage.')
    process.exit(1)
  }

  return opts
}

function parseTimestamp(value, format) {
  if (format === 'seconds') {
    const n = typeof value === 'number' ? value : parseFloat(String(value))
    return Number.isFinite(n) ? n : 0
  }

  const raw = String(value).trim()
  const dot = raw.indexOf('.')
  if (dot === -1) return (parseInt(raw, 10) || 0) * 60
  const minutes = parseInt(raw.slice(0, dot), 10) || 0
  const seconds = parseInt(raw.slice(dot + 1), 10) || 0
  return minutes * 60 + seconds
}

function loadAyahs(data, timeFormat) {
  const list = Array.isArray(data.timestamps)
    ? data.timestamps
    : data.chunks?.[0]?.ayahs

  if (!Array.isArray(list) || list.length === 0) {
    throw new Error('JSON must contain a non-empty "timestamps" array or chunks[0].ayahs')
  }

  const chunkFormat = data.chunks?.[0]?.timeFormat ?? data.timeFormat ?? timeFormat

  return list.map((row) => {
    const key = row.key ?? `${row.surah}:${row.ayah}`
    const start = parseTimestamp(row.start, chunkFormat)
    const end = parseTimestamp(row.end, chunkFormat)
    return { key, start, end }
  })
}

function outputName(verseKey) {
  const [surah, ayah] = verseKey.split(':')
  return `${surah}-${ayah}.mp3`
}

function runFfmpeg(ffmpeg, input, start, end, outFile) {
  const args = [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-i',
    input,
    '-ss',
    String(start),
    '-to',
    String(end),
    '-c',
    'copy',
    outFile,
  ]

  const result = spawnSync(ffmpeg, args, { stdio: 'inherit', shell: false })
  if (result.error) {
    throw result.error
  }
  if (result.status !== 0) {
    throw new Error(`ffmpeg failed for ${outFile} (exit ${result.status})`)
  }
}

async function main() {
  const opts = parseArgs(process.argv)
  const cwd = process.cwd()
  const inputPath = path.resolve(cwd, opts.input)
  const jsonPath = path.resolve(cwd, opts.json)
  const outputDir = path.resolve(cwd, opts.output)

  try {
    await access(inputPath)
  } catch {
    console.error(`Error: input file not found:\n  ${inputPath}`)
    console.error('Copy your source MP3 there, or pass the real path with --input.')
    process.exit(1)
  }

  const raw = await readFile(jsonPath, 'utf8')
  const data = JSON.parse(raw)
  const ayahs = loadAyahs(data, opts.timeFormat)

  await mkdir(outputDir, { recursive: true })

  console.log(`Input:  ${inputPath}`)
  console.log(`JSON:   ${jsonPath} (${ayahs.length} ayahs)`)
  console.log(`Output: ${outputDir}`)
  console.log('')

  const manifestAyahs = []

  for (const ayah of ayahs) {
    if (!ayah.key || ayah.end <= ayah.start) {
      console.warn(`Skip invalid row: ${JSON.stringify(ayah)}`)
      continue
    }

    const fileName = outputName(ayah.key)
    const outFile = path.join(outputDir, fileName)
    const duration = Math.round((ayah.end - ayah.start) * 100) / 100

    process.stdout.write(`Cutting ${ayah.key} → ${fileName} ... `)
    runFfmpeg(opts.ffmpeg, inputPath, ayah.start, ayah.end, outFile)
    console.log('done')

    manifestAyahs.push({
      key: ayah.key,
      file: fileName,
      start: 0,
      end: duration,
    })
  }

  if (opts.manifestOut) {
    const chunks = manifestAyahs.map(({ key, file, start, end }) => ({
      file: `${opts.filePrefix}${file}`,
      timeFormat: 'seconds',
      ayahs: [{ key, start, end }],
    }))
    const manifestPath = path.resolve(cwd, opts.manifestOut)
    await writeFile(manifestPath, `${JSON.stringify({ chunks }, null, 2)}\n`, 'utf8')
    console.log(`\nManifest fragment: ${manifestPath}`)
  }

  console.log(`\nFinished ${manifestAyahs.length} ayahs.`)
  console.log('Per-ayah manifest entries use start:0 and end:duration (play whole file).')
}

main().catch((err) => {
  console.error(err.message ?? err)
  process.exit(1)
})
