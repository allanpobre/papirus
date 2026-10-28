// Papirus offline: guarda o app depois da primeira visita, para abrir sem internet.
// Páginas: rede primeiro (pega versão nova), cache se estiver offline.
// Arquivos (js, css, fontes, ícones): cache primeiro; os nomes mudam a cada versão.
// v2: marca e ícones novos (os nomes dos ícones não mudam, então o cache antigo sai).
const CACHE = 'papirus-v2'

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key)
      await self.clients.claim()
    })(),
  )
})

// A página manda o que já carregou antes do service worker existir.
self.addEventListener('message', (event) => {
  const urls = event.data && event.data.cache
  if (!Array.isArray(urls)) return
  event.waitUntil(caches.open(CACHE).then((c) => Promise.all(urls.map((u) => c.add(u).catch(() => undefined)))))
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  // Só o próprio site; servidor (Supabase) e outros ficam de fora.
  if (url.origin !== self.location.origin) return

  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req)
          const c = await caches.open(CACHE)
          c.put(url.pathname, res.clone())
          return res
        } catch {
          return (await caches.match(url.pathname)) || (await caches.match(url.pathname + 'index.html')) || Response.error()
        }
      })(),
    )
    return
  }

  event.respondWith(
    (async () => {
      const hit = await caches.match(req)
      if (hit) return hit
      const res = await fetch(req)
      if (res.ok) (await caches.open(CACHE)).put(req, res.clone())
      return res
    })(),
  )
})
