#!/usr/bin/env node
/** Skip if fonts already present (local dev); download on CI deploy. */
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const marker = path.join(__dirname, '..', 'public', 'fonts', 'qcf', 'p604.woff2')
if (fs.existsSync(marker)) {
  console.log('Mushaf fonts already present — skipping download.')
  process.exit(0)
}

const onCi = Boolean(process.env.CI || process.env.VERCEL)
const forceDownload = process.env.FORCE_MUSHAF_FONT_DOWNLOAD === '1'

if (onCi && !forceDownload) {
  console.warn(
    'Mushaf fonts missing on CI/Vercel — skipping font download to avoid deploy failure.\n' +
      'Set FORCE_MUSHAF_FONT_DOWNLOAD=1 if you want deploy-time font download.'
  )
  process.exit(0)
}

try {
  console.log('Mushaf fonts missing — downloading for deploy…')
  execSync('node scripts/download-quran-data.js --fonts-only', {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..'),
  })
} catch (err) {
  if (onCi) {
    console.warn(
      'Font download failed on CI/Vercel; continuing build to prevent deployment failure.\n' +
        'Offline font package may be incomplete for this deploy.'
    )
    process.exit(0)
  }
  throw err
}
