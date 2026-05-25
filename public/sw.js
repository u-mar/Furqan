const CACHE_VERSION = 'al-quran-v7'
const STATIC_CACHE = 'al-quran-static-v7'

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
          .filter((k) => k !== STATIC_CACHE && k !== CACHE_VERSION)
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

  // Mushaf page fonts + bundled assets — cache-first for offline reading.
  if (url.pathname.startsWith('/fonts/')) {
    event.respondWith(cacheFirst(event.request))
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

async function networkFirst(request) {
  try {
    const response = await fetch(request)
    if (response.ok && response.type === 'basic') {
      const cache = await caches.open(CACHE_VERSION)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    const cached = await caches.match(request)
    if (cached) return cached
    return new Response('Offline', { status: 503, statusText: 'Offline' })
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached

  const response = await fetch(request)
  if (response.ok) {
    const cache = await caches.open(STATIC_CACHE)
    cache.put(request, response.clone())
  }
  return response
}
