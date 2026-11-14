/**
 * App instalável: registra o service worker (offline) e guarda o convite do navegador
 * para instalar, que aparece como botão em "Instalar o app".
 */
type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

let deferred: InstallPrompt | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

/** Endereços completos de `precache.json` (arquivos relativos à raiz do site). */
export function precacheUrls(files: unknown, root: string): string[] {
  if (!Array.isArray(files)) return []
  return files.filter((f): f is string => typeof f === 'string' && /^[\w./-]+$/.test(f) && !f.includes('..')).map((f) => `${root}${f}`)
}

/** Depois que o app abriu, baixa em segundo plano todas as telas e fontes: assim abrir sem internet funciona em qualquer tela. */
async function precacheEverything(reg: ServiceWorkerRegistration, root: string) {
  const conn = (navigator as { connection?: { saveData?: boolean } }).connection
  if (conn?.saveData || !navigator.onLine) return
  try {
    const res = await fetch(`${root}precache.json`, { cache: 'no-cache' })
    if (!res.ok) return
    const urls = precacheUrls(((await res.json()) as { files?: unknown }).files, root)
    if (urls.length) (reg.active ?? (await navigator.serviceWorker.ready).active)?.postMessage({ cache: urls, prune: true })
  } catch {
    // Sem conexão agora: na próxima abertura tenta de novo.
  }
}

export function startPwa() {
  addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as InstallPrompt
    emit()
  })
  addEventListener('appinstalled', () => {
    deferred = null
    emit()
  })
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  // O app mora em …/app/; o service worker fica um nível acima, para valer para o site todo.
  if (!/\/app\/?$/.test(location.pathname)) return
  const root = location.pathname.replace(/app\/?$/, '')
  navigator.serviceWorker
    .register(`${root}sw.js`, { scope: root })
    .then(async (reg) => {
      const sw = reg.active ?? reg.waiting ?? reg.installing
      if (!sw) return
      // O que esta página já baixou entra no cache (o service worker ainda não existia).
      const urls = performance
        .getEntriesByType('resource')
        .map((r) => r.name)
        .filter((u) => u.startsWith(location.origin))
      const send = () => (reg.active ?? sw).postMessage({ cache: [location.pathname, ...urls] })
      if (reg.active) send()
      else sw.addEventListener('statechange', () => sw.state === 'activated' && send())
      // Com o app já na tela, baixa o resto (telas que ainda não foram abertas) sem atrapalhar o começo.
      setTimeout(() => void precacheEverything(reg, root), 4000)
    })
    .catch(() => undefined)
}

export const subscribeInstall = (cb: () => void) => {
  listeners.add(cb)
  return () => listeners.delete(cb)
}
export const canInstall = () => deferred !== null
export const isInstalled = () => matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
export const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

export async function install(): Promise<boolean> {
  if (!deferred) return false
  const d = deferred
  deferred = null
  emit()
  await d.prompt()
  return (await d.userChoice).outcome === 'accepted'
}

// ─── Versão nova ──────────────────────────────────────────────────────
// Quem deixa o app aberto (no celular, por dias) não recarrega a página e não pega a versão nova.
// De tempos em tempos (e ao voltar para o app), lê a página do servidor e compara o script principal.

/** O script principal citado numa página (`/assets/app-XXXX.js`), ou null. */
export function mainScriptOf(html: string, base: string): string | null {
  const m = html.match(/<script[^>]*type="module"[^>]*src="([^"]+)"/) ?? html.match(/<script[^>]*src="([^"]+)"[^>]*type="module"/)
  return m ? new URL(m[1], base).pathname : null
}

let updateReady = false
const updateListeners = new Set<() => void>()

async function checkForUpdate() {
  if (updateReady || !navigator.onLine) return
  const here = document.querySelector<HTMLScriptElement>('script[type="module"][src]')
  if (!here) return
  const mine = new URL(here.src, location.href).pathname
  try {
    // O parâmetro faz o service worker deixar passar direto para a rede (sem cache).
    const dir = location.pathname.replace(/[^/]*$/, '')
    const res = await fetch(`${dir}?checar-versao=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) return
    const theirs = mainScriptOf(await res.text(), location.href)
    if (theirs && theirs !== mine) {
      updateReady = true
      updateListeners.forEach((l) => l())
    }
  } catch {
    // Sem conexão: tenta de novo mais tarde.
  }
}

/** Começa a olhar se há versão nova (só no app publicado). */
export function watchForUpdates() {
  if (!import.meta.env.PROD) return
  setTimeout(() => void checkForUpdate(), 60_000)
  setInterval(() => void checkForUpdate(), 30 * 60_000)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void checkForUpdate()
  })
}

export const hasUpdate = () => updateReady
export const subscribeUpdate = (cb: () => void) => {
  updateListeners.add(cb)
  return () => {
    updateListeners.delete(cb)
  }
}
