const CACHE_VERSION = 'al-quran-v10'
const STATIC_CACHE = 'al-quran-static-v9'
/** Must match lib/offline-font-cache.ts QCF_FONT_CACHE_NAME */
const QCF_FONT_CACHE = 'muyassar-qcf-fonts-v2'
const TRANSLATIONS_CACHE = 'muyassar-translations-v1'

/** Only cache data that is safe to reuse; never precache HTML (stale home UI). */
const PRECACHE = ['/quran-chapters.json', '/quran-data.json']

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
              k !== TRANSLATIONS_CACHE
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
      fetch(event.request).then((response) => {
        if (response.ok) {
          const copy = response.clone()
          caches.open(STATIC_CACHE).then((cache) => cache.put(event.request, copy))
        }
        return response
      })
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
