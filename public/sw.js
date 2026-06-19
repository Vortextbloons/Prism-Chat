const CACHE = 'prism-shell-v1'

function assetUrl(path) {
  return new URL(path, self.location.href).href
}

const SHELL_ASSETS = ['./', 'index.html', 'manifest.json', 'favicon.svg'].map(assetUrl)

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL_ASSETS)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return

  const url = new URL(event.request.url)
  if (url.origin !== self.location.origin) return

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetched = fetch(event.request)
        .then((response) => {
          if (response.ok && url.pathname.includes('/assets/')) {
            const clone = response.clone()
            caches.open(CACHE).then((cache) => cache.put(event.request, clone))
          }
          return response
        })
        .catch(() => cached)
      return cached || fetched
    }),
  )
})
