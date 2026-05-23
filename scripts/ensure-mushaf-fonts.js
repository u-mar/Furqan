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

console.log('Mushaf fonts missing — downloading for deploy…')
execSync('node scripts/download-quran-data.js --fonts-only', {
  stdio: 'inherit',
  cwd: path.join(__dirname, '..'),
})
