/**
 * Writes public/sw-precache.json: every script and stylesheet of this build (/_next/static/...), for
 * the service worker (public/sw.js) to keep on the phone. The screens it saves list only the code they
 * load at first; the pieces loaded later (Now playing, the Nature and Sleep sheets, translation mode,
 * Settings' sheets) were saved only once opened online, and opened offline before that, a screen showed
 * but its buttons did nothing. Run after `next build` (see "build" in package.json).
 */
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const staticDir = path.join(root, '.next', 'static')
const out = path.join(root, 'public', 'sw-precache.json')

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    return entry.isDirectory() ? walk(full) : [full]
  })
}

if (!fs.existsSync(staticDir)) {
  console.warn('[sw-precache] no .next/static: run after next build')
  process.exit(0)
}

const files = walk(staticDir)
  .filter((file) => /\.(js|css)$/.test(file))
  .map((file) => '/_next/static/' + path.relative(staticDir, file).split(path.sep).join('/'))
  .sort()

let buildId = ''
try {
  buildId = fs.readFileSync(path.join(root, '.next', 'BUILD_ID'), 'utf8').trim()
} catch {
  // Not essential: the list itself says what to keep.
}

fs.writeFileSync(out, JSON.stringify({ buildId, files }))
console.log(`[sw-precache] ${files.length} files listed in public/sw-precache.json`)
