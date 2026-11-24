const CACHE_VERSION = 'al-quran-v12'
const STATIC_CACHE = 'al-quran-static-v12'
/** Must match lib/offline-font-cache.ts QCF_FONT_CACHE_NAME */
const QCF_FONT_CACHE = 'naba-qcf-fonts-v4'
// The V2 page fonts saved before the V4 ones; still answered offline until the page replaces them.
const OLD_QCF_FONT_CACHE = 'muyassar-qcf-fonts-v2'
const TRANSLATIONS_CACHE = 'muyassar-translations-v1'
/** Reciter portraits, bundled locally under /reciters/ — small, rarely
 *  change, so a dedicated stable cache keeps them offline across app updates
 *  the same way fonts and translations do. */
const RECITER_PHOTOS_CACHE = 'muyassar-reciter-photos-v1'

/** Shown for a screen opened offline that has never been opened online — the one page safe to precache, since it never goes stale. */
const OFFLINE_PAGE = '/offline.html'

/**
 * Only small data that is safe to reuse; never HTML (stale home UI). The whole
 * Quran (16 MB) and the surah title font (1.8 MB) used to be fetched here on
 * every phone's first visit, which choked a slow connection for every screen;
 * they are saved when someone downloads the Quran for offline reading, or the
 * first time a screen actually needs them.
 */
const PRECACHE = ['/quran-chapters.json', OFFLINE_PAGE]

/**
 * The app's main screens. Saved with their scripts and styles when this worker
 * is installed, so each can open from the phone when offline or on a slow
 * connection (screenNetworkFirst); online, the newest copy opens.
 */
const APP_SHELL = ['/', '/read', '/listen', '/qari', '/prayer', '/prayer/qibla', '/settings', '/halaqa']

/** The scripts and styles a page's HTML loads (Next's hashed files, which never change). */
function staticAssetsIn(html) {
  // Whole file names only: the page's streamed data can cut one in two ("/_next/static/m" … "edia/…").
  return [...new Set(html.match(/\/_next\/static\/[^"'\s)\\]+\.[a-z0-9]{2,5}(?=["'\s)\\]|$)/g) || [])]
}

/** Saves the files a page needs that are not saved yet, a few at a time. True when all of them are saved. */
async function saveAssets(urls) {
  const cache = await caches.open(STATIC_CACHE)
  let all = true
  for (let i = 0; i < urls.length; i += 6) {
    await Promise.all(
      urls.slice(i, i + 6).map(async (url) => {
        try {
          if (await cache.match(url)) return
          const response = await fetch(url)
          if (response.ok) await cache.put(url, response)
          else all = false
        } catch {
          all = false
        }
      })
    )
  }
  return all
}

/**
 * Keeps a screen's HTML (under its path, whatever the query) and everything it loads: the scripts
 * first, and the HTML only once every one of them is saved. Saved the other way round, a connection
 * lost halfway left a page whose scripts were missing: opened offline, it showed but never came
 * alive, and no button could be tapped. The copy saved before stays until a complete one replaces it.
 */
async function saveScreen(path, response) {
  const html = await response.clone().text()
  if (!(await saveAssets(staticAssetsIn(html)))) return
  const cache = await caches.open(CACHE_VERSION)
  await cache.put(new URL(path, self.location.origin).href, response)
}

/** fetch(), given up on after `ms`: a connection that answers nothing must not hold the app. */
function fetchWithin(request, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms)
    fetch(request).then(
      (response) => {
        clearTimeout(timer)
        resolve(response)
      },
      (err) => {
        clearTimeout(timer)
        reject(err)
      }
    )
  })
}

/** The data Next fetches to move to another screen inside the app (or to prepare one). */
function isScreenData(request, url) {
  return request.headers.get('RSC') === '1' || url.searchParams.has('_rsc')
}

/** How long moving to another screen waits for the network before opening the saved copy instead. */
const SCREEN_DATA_WAIT_MS = 5000

/**
 * Every script and stylesheet of the current build (public/sw-precache.json, written at build time),
 * kept on the phone, so every screen and every sheet works offline, not only the parts already opened
 * online. Looked at again now and then, since a new build does not change this file: only what is not
 * kept yet is downloaded.
 */
const PRECACHE_LIST = '/sw-precache.json'
const PRECACHE_EVERY_MS = 6 * 60 * 60 * 1000
let precachedAt = 0

async function saveAllCode() {
  try {
    const response = await fetch(PRECACHE_LIST, { cache: 'no-cache' })
    if (!response.ok) return
    const { files } = await response.json()
    if (Array.isArray(files) && files.length) await saveAssets(files.filter((f) => typeof f === 'string' && f.startsWith('/_next/static/')))
    precachedAt = Date.now()
  } catch {
    // Offline or no list: tried again later.
  }
}

/** saveAllCode, at most every few hours, in the background. */
function refreshAllCode(event) {
  if (Date.now() - precachedAt < PRECACHE_EVERY_MS) return
  precachedAt = Date.now()
  event.waitUntil(saveAllCode())
}

async function saveAppShell() {
  await Promise.all(
    APP_SHELL.map(async (path) => {
      try {
        const response = await fetch(path, { credentials: 'same-origin', cache: 'no-cache' })
        if (response.ok && response.type === 'basic') await saveScreen(path, response)
      } catch {
        // Offline while installing: that screen is saved the first time it is opened.
      }
    })
  )
}

function isNavigationRequest(request) {
  return (
    request.mode === 'navigate' ||
    (request.headers.get('accept') || '').includes('text/html')
  )
}

// The main screens are saved while installing, when the worker in charge still answers everything.
// They used to be saved after taking over, and until every screen and script had downloaded no
// request was answered at all: on a weak connection the app froze on opening, or showed
// "No internet connection".
self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE).catch(() => undefined)),
      saveAppShell(),
      saveAllCode(),
    ]).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        // Only this worker's own earlier versions go. Everything people saved (the Quran text,
        // page fonts, translations, downloaded surahs, photos) sits in caches of its own and
        // stays: deleting every other cache here used to wipe them on each app update.
        Promise.all(
          keys
            .filter((k) => k.startsWith('al-quran-') && k !== STATIC_CACHE && k !== CACHE_VERSION)
            .map((k) => caches.delete(k))
        )
      )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return

  const url = new URL(event.request.url)
  if (url.origin !== self.location.origin) return

  // A screen: the newest from the network when it answers within a few seconds, so an update shows
  // on the first open after it; the copy saved on the phone when offline or the network is slow.
  if (isNavigationRequest(event.request)) {
    event.respondWith(screenNetworkFirst(event))
    // A new build's code, kept while online (a new deploy does not change this worker).
    if (self.navigator.onLine !== false) refreshAllCode(event)
    return
  }

  if (url.pathname === '/sw.js') {
    event.respondWith(fetch(event.request))
    return
  }

  // Moving to another screen: offline, or with no answer within a few seconds, Next is told it
  // failed and opens the screen as a page instead, which comes from the phone at once. Waiting on
  // the network here is what made taps on Settings and the rest seem to do nothing.
  if (isScreenData(event.request, url)) {
    event.respondWith(
      self.navigator.onLine === false
        ? Response.error()
        : fetchWithin(event.request, SCREEN_DATA_WAIT_MS).catch(() => Response.error())
    )
    return
  }

  // Mushaf QCF page fonts (offline download stores under /qcf/p{n}.woff2 keys).
  if (/^\/qcf\/p\d+\.woff2$/.test(url.pathname)) {
    event.respondWith(qcfFontCacheFirst(event.request))
    return
  }

  // Surah header + other bundled fonts
  if (url.pathname.startsWith('/fonts/')) {
    event.respondWith(cacheFirst(event.request, QCF_FONT_CACHE))
    return
  }

  // Reciter portraits (Listen screen) — small, bundled locally, offline-first.
  if (url.pathname.startsWith('/reciters/')) {
    event.respondWith(cacheFirst(event.request, RECITER_PHOTOS_CACHE))
    return
  }

  if (url.pathname === '/quran-data.json') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone()
            caches.open(STATIC_CACHE).then((cache) => cache.put(event.request, copy))
          }
          return response
        })
        // Offline: the copy saved earlier is the Quran.
        .catch(() => caches.match(event.request))
    )
    return
  }

  // Next.js hashed assets are immutable — cache-first is fine.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(event.request))
    return
  }

  event.respondWith(networkFirst(event.request))
})

function pathnameCacheKey(request) {
  const url = new URL(request.url)
  return url.origin + url.pathname
}

/** How long opening a screen waits for the network before opening the copy saved on the phone. */
const SCREEN_WAIT_MS = 3000

/**
 * A screen, newest first. It used to open from the phone's saved copy every time, with the new one
 * fetched for the next open: after an update, every screen showed the previous design once (and a
 * refresh showed it again). Now the network is asked first; only when it gives nothing within a few
 * seconds, or the phone is offline, does the saved copy open, so a weak connection still never
 * holds the app. A fresh copy that arrives late is still saved for next time.
 */
async function screenNetworkFirst(event) {
  const request = event.request
  const url = new URL(request.url)
  const fresh = fetch(request)
  // Saved for next time (with its scripts) on the side: the page does not wait for that.
  event.waitUntil(
    fresh
      .then((response) => {
        if (response.ok && response.type === 'basic' && !response.redirected) {
          return saveScreen(url.pathname, response.clone())
        }
      })
      .catch(() => undefined)
  )

  if (self.navigator.onLine !== false) {
    try {
      return await Promise.race([
        // A server error opens the saved copy too, rather than an error page.
        fresh.then((response) => (response.status >= 500 ? Promise.reject(new Error('server')) : response)),
        new Promise((_, reject) => setTimeout(() => reject(new Error('slow')), SCREEN_WAIT_MS)),
      ])
    } catch {
      // Slow or failed: the saved copy below, if there is one.
    }
  }
  const cached = (await caches.match(request)) || (await caches.match(pathnameCacheKey(request)))
  if (cached) return cached
  try {
    return await fresh
  } catch {
    return (await caches.match(OFFLINE_PAGE)) || new Response('Offline', { status: 503, statusText: 'Offline' })
  }
}

async function networkFirst(request) {
  const pathKey = pathnameCacheKey(request)
  const isNav = isNavigationRequest(request)

  try {
    const response = await fetch(request)
    if (response.ok && response.type === 'basic') {
      const cache = await caches.open(CACHE_VERSION)
      cache.put(request, response.clone())
      // Same HTML shell for /settings?returnTo=… as /settings — reuse when offline.
      if (isNav) {
        cache.put(pathKey, response.clone())
      }
    }
    return response
  } catch {
    const cached = await caches.match(request)
    if (cached) return cached
    if (isNav) {
      const byPath = await caches.match(pathKey)
      if (byPath) return byPath
      const offline = await caches.match(OFFLINE_PAGE)
      if (offline) return offline
    }
    return new Response('Offline', { status: 503, statusText: 'Offline' })
  }
}

async function qcfFontCacheFirst(request) {
  const qcfCache = await caches.open(QCF_FONT_CACHE)
  const hit = await qcfCache.match(request)
  if (hit) return hit

  try {
    const response = await fetch(request)
    if (response.ok) return response
  } catch {
    /* offline and not in download cache */
  }

  // Offline with only the earlier (V2) fonts saved: those rather than none.
  if (await caches.has(OLD_QCF_FONT_CACHE)) {
    const oldCache = await caches.open(OLD_QCF_FONT_CACHE)
    const url = new URL(request.url)
    const oldHit =
      (await oldCache.match(url.pathname)) || (await oldCache.match(url.pathname.replace(/^\/qcf\//, '/fonts/qcf/')))
    if (oldHit) return oldHit
  }

  return new Response('QCF font not cached', { status: 404, statusText: 'Not Found' })
}

async function cacheFirst(request, cacheName = STATIC_CACHE) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  if (cached) return cached

  const response = await fetch(request)
  if (response.ok) {
    cache.put(request, response.clone())
  }
  return response
}

/* ----------------------------------------------------------------- push */

/** A notification from the server: someone liked a recitation or followed. */
self.addEventListener('push', (event) => {
  let message = { title: 'Naba', body: '', url: '/qari/notifications' }
  try {
    if (event.data) message = { ...message, ...event.data.json() }
  } catch {
    // A plain-text push still shows.
    if (event.data) message.body = event.data.text()
  }
  event.waitUntil(
    self.registration.showNotification(message.title, {
      body: message.body,
      tag: message.tag,
      // The person's picture when the message carries one, as on a social app; else the app's own mark.
      icon: message.image || '/icons/icon-192',
      badge: '/icons/badge-96',
      data: { url: message.url },
    })
  )
})

/** Tapping it opens the app on the right screen, reusing a window that is already open. */
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if ('focus' in client) {
          client.navigate(target).catch(() => {})
          return client.focus()
        }
      }
      return self.clients.openWindow(target)
    })
  )
})
