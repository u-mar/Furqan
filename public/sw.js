const CACHE_VERSION = 'al-quran-v10'
const STATIC_CACHE = 'al-quran-static-v10'
/** Must match lib/offline-font-cache.ts QCF_FONT_CACHE_NAME */
const QCF_FONT_CACHE = 'muyassar-qcf-fonts-v2'
const TRANSLATIONS_CACHE = 'muyassar-translations-v1'
/** Must match lib/asr/model-cache.ts CACHE_NAME */
const ASR_MODEL_CACHE = 'muyassar-asr-model-v1'

/** Only cache data that is safe to reuse; never precache HTML (stale home UI). */
const PRECACHE = ['/quran-chapters.json', '/quran-data.json', '/fonts/surah-header-color.ttf']

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
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter(
            (k) =>
              k !== STATIC_CACHE &&
              k !== CACHE_VERSION &&
              k !== QCF_FONT_CACHE &&
              k !== TRANSLATIONS_CACHE &&
              k !== ASR_MODEL_CACHE
          )
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

  // HTML / app pages: always try network first so phones get latest UI.
  if (isNavigationRequest(event.request)) {
    event.respondWith(networkFirst(event.request))
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
  let message = { title: 'Al Furqaan', body: '', url: '/qari/notifications' }
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
      badge: '/icons/icon-192',
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
