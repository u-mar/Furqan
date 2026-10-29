const CACHE_VERSION = 'al-quran-v12'
const STATIC_CACHE = 'al-quran-static-v12'
/** Must match lib/offline-font-cache.ts QCF_FONT_CACHE_NAME */
const QCF_FONT_CACHE = 'muyassar-qcf-fonts-v2'
const TRANSLATIONS_CACHE = 'muyassar-translations-v1'
/** The speech model for marking Qari ayat. Must match lib/asr/offline-model-cache.ts QARI_ASR_CACHE */
const QARI_ASR_CACHE = 'muyassar-qari-asr-v1'
/** Reciter portraits, bundled locally under /reciters/ — small, rarely
 *  change, so a dedicated stable cache keeps them offline across app updates
 *  the same way fonts/translations/the ASR model do. */
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
 * is installed, so from then on each opens at once from the phone, offline
 * too, while a fresh copy is fetched in the background for next time.
 */
const APP_SHELL = ['/', '/read', '/listen', '/qari', '/prayer', '/prayer/qibla', '/settings', '/halaqa']

/** The scripts and styles a page's HTML loads (Next's hashed files, which never change). */
function staticAssetsIn(html) {
  return [...new Set(html.match(/\/_next\/static\/[^"'\s)\\]+/g) || [])]
}

/** Saves the files a page needs that are not saved yet, a few at a time. */
async function saveAssets(urls) {
  const cache = await caches.open(STATIC_CACHE)
  for (let i = 0; i < urls.length; i += 6) {
    await Promise.all(
      urls.slice(i, i + 6).map(async (url) => {
        try {
          if (await cache.match(url)) return
          const response = await fetch(url)
          if (response.ok) await cache.put(url, response)
        } catch {
          // Fetched again the first time the page asks for it.
        }
      })
    )
  }
}

/** Keeps a screen's HTML (under its path, whatever the query) and everything it loads. */
async function saveScreen(path, response) {
  const html = await response.clone().text()
  const cache = await caches.open(CACHE_VERSION)
  await cache.put(new URL(path, self.location.origin).href, response)
  await saveAssets(staticAssetsIn(html))
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

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE).catch(() => undefined))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    saveAppShell()
      .then(() => caches.keys())
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

  // A screen: from the phone at once when it is saved, refreshed in the background for next time;
  // from the network (saved as it comes) when it is not.
  if (isNavigationRequest(event.request)) {
    event.respondWith(screenFromPhoneFirst(event))
    return
  }

  if (url.pathname === '/sw.js') {
    event.respondWith(fetch(event.request))
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

async function screenFromPhoneFirst(event) {
  const request = event.request
  const url = new URL(request.url)
  const cached = (await caches.match(request)) || (await caches.match(pathnameCacheKey(request)))
  const fresh = fetch(request).then(async (response) => {
    if (response.ok && response.type === 'basic' && !response.redirected) {
      await saveScreen(url.pathname, response.clone())
    }
    return response
  })
  if (cached) {
    // The saved copy now; the new one (and any new scripts it needs) is kept for the next open.
    event.waitUntil(fresh.catch(() => undefined))
    return cached
  }
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

  const url = new URL(request.url)
  const legacyPath = url.pathname.replace(/^\/qcf\//, '/fonts/qcf/')
  if (legacyPath !== url.pathname) {
    const legacyHit = await qcfCache.match(legacyPath)
    if (legacyHit) return legacyHit
  }

  try {
    const response = await fetch(request)
    if (response.ok) return response
  } catch {
    /* offline and not in download cache */
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
      icon: '/icons/icon-192',
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
