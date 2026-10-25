/**
 * App instalável: registra o service worker (offline) e guarda o convite do navegador
 * para instalar, que aparece como botão em "Instalar o app".
 */
type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

let deferred: InstallPrompt | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

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
