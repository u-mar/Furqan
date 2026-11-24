/**
 * Saves a copy of Naba's main screens, as qurannaba.com serves them now, for the Play Store app to
 * carry inside it (android/…/AppShell.java): the screens' HTML, every script and stylesheet of that
 * build (from /sw-precache.json), and the fonts the stylesheets use. With it, the app opens with no
 * connection even on its very first launch, before the site has ever been saved on the phone.
 *
 * Run before building the app, after the site is deployed:  node scripts/snapshot-app-shell.mjs
 * It writes to ~/.naba-build/app-shell/appshell (outside the project, like the bundled mushaf).
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const SITE = process.env.NABA_SITE || 'https://qurannaba.com'
const OUT = path.join(os.homedir(), '.naba-build', 'app-shell', 'appshell')
/** The screens kept, and the file each is saved as. */
const SCREENS = {
  '/': 'index',
  '/read': 'read',
  '/listen': 'listen',
  '/prayer': 'prayer',
  '/prayer/qibla': 'prayer-qibla',
  '/settings': 'settings',
  '/qari': 'qari',
  '/halaqa': 'halaqa',
}
/** Small data the screens read at once. */
const EXTRA = ['/quran-chapters.json']
// Asked for as the app asks, so the site answers exactly as it does in the app.
const HEADERS = { 'user-agent': 'Mozilla/5.0 (Linux; Android 14) NabaAndroid NabaQuran/2' }

async function get(url) {
  const res = await fetch(url, { headers: HEADERS })
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  return Buffer.from(await res.arrayBuffer())
}

function save(rel, data) {
  const file = path.join(OUT, rel)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, data)
}

fs.rmSync(OUT, { recursive: true, force: true })

const list = JSON.parse((await get(`${SITE}/sw-precache.json`)).toString('utf8'))
if (!Array.isArray(list.files) || !list.files.length) throw new Error('sw-precache.json lists no files: deploy the site first')

const pages = {}
for (const [route, name] of Object.entries(SCREENS)) {
  const html = (await get(`${SITE}${route}`)).toString('utf8')
  pages[route] = `pages/${name}.html`
  save(pages[route], html)
}

// Every script and stylesheet of the build, and whatever else the screens point to under /_next/static.
const wanted = new Set(list.files)
for (const rel of Object.values(pages)) {
  const html = fs.readFileSync(path.join(OUT, rel), 'utf8')
  for (const m of html.matchAll(/\/_next\/static\/[^"'\s)\\]+\.[a-z0-9]{2,5}(?=["'\s)\\]|$)/g)) wanted.add(m[0])
}
let bytes = 0
for (const file of wanted) {
  const data = await get(`${SITE}${file}`)
  bytes += data.length
  save(file.slice(1), data)
  // The fonts a stylesheet uses.
  if (file.endsWith('.css')) {
    for (const m of data.toString('utf8').matchAll(/url\((\/_next\/static\/media\/[^)"']+)\)/g)) {
      if (wanted.has(m[1])) continue
      wanted.add(m[1])
      const font = await get(`${SITE}${m[1]}`)
      bytes += font.length
      save(m[1].slice(1), font)
    }
  }
}
for (const file of EXTRA) {
  const data = await get(`${SITE}${file}`)
  bytes += data.length
  save(file.slice(1), data)
}

save('manifest.json', JSON.stringify({ site: SITE, buildId: list.buildId, savedAt: new Date().toISOString(), pages }))
console.log(`[app-shell] ${Object.keys(pages).length} screens and ${wanted.size + EXTRA.length} files (${(bytes / 1048576).toFixed(1)} MB) saved to ${OUT}`)
