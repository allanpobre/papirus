// Papirus offline: guarda o app depois da primeira visita, para abrir sem internet.
// Páginas: rede primeiro (pega versão nova), cache se estiver offline.
// Arquivos (js, css, fontes, ícones): cache primeiro; os nomes mudam a cada versão.
// v2: marca e ícones novos (os nomes dos ícones não mudam, então o cache antigo sai).
// v4: acha os arquivos mesmo com "Vary" no servidor, só guarda página que veio certa e baixa todas as telas de antemão.
const CACHE = 'papirus-v4'
// A raiz do site (onde mora este arquivo): "/" no domínio próprio, "/nome/" numa subpasta.
const ROOT = new URL('./', self.location).pathname

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key)
      await self.clients.claim()
    })(),
  )
})

// Os nomes dos arquivos mudam a cada versão: o nome já diz qual é, então o "Vary" do servidor não deve atrapalhar.
const find = (req) => caches.match(req, { ignoreVary: true })

// A página manda o que já carregou antes do service worker existir e, depois, a lista de todas as telas
// (`prune`: o que ficou de versões antigas em /assets/ e não está na lista sai do cache).
self.addEventListener('message', (event) => {
  const urls = event.data && event.data.cache
  if (!Array.isArray(urls)) return
  const prune = event.data.prune === true
  event.waitUntil(
    (async () => {
      const c = await caches.open(CACHE)
      await Promise.all(
        urls.map(async (u) => {
          if (await c.match(u, { ignoreVary: true })) return
          await c.add(u).catch(() => undefined)
        }),
      )
      if (!prune) return
      const keep = new Set(urls.map((u) => new URL(u, self.location).pathname))
      for (const req of await c.keys()) {
        const path = new URL(req.url).pathname
        if (path.startsWith(ROOT + 'assets/') && !keep.has(path)) await c.delete(req)
      }
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  // Só o próprio site; servidor (Supabase) e outros ficam de fora.
  if (url.origin !== self.location.origin) return
  // A conferência de versão nova vai sempre à rede e não entra no cache.
  if (url.searchParams.has('checar-versao')) return

  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          // Sempre confere com o servidor (o GitHub Pages deixa guardar a página por 10 minutos):
          // assim, abrir o app depois de uma publicação já traz a versão nova.
          const net = await fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' })
          // Resposta de redirecionamento ("/app" → "/app/") não pode ir direto para a navegação: refaz sem a marca.
          const res = net.redirected ? new Response(net.body, { status: net.status, statusText: net.statusText, headers: net.headers }) : net
          // Só guarda página que veio certa (um erro do servidor não pode virar a "última versão").
          if (res.ok) (await caches.open(CACHE)).put(url.pathname, res.clone())
          return res
        } catch {
          // Sem internet: a última página guardada. "/app" sem a barra e subpáginas do app caem no app.
          const inApp = url.pathname === ROOT + 'app' || url.pathname.startsWith(ROOT + 'app/')
          return (
            (await find(url.pathname)) ||
            (await find(url.pathname + 'index.html')) ||
            (inApp ? await find(ROOT + 'app/') : undefined) ||
            Response.error()
          )
        }
      })(),
    )
    return
  }

  event.respondWith(
    (async () => {
      const hit = await find(req)
      if (hit) return hit
      const res = await fetch(req)
      if (res.ok) (await caches.open(CACHE)).put(req, res.clone())
      return res
    })(),
  )
})
