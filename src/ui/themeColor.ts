/**
 * A cor das barras do celular (a de cima, com hora e bateria, e a de baixo, com os botões
 * do Android) acompanha o que está na tela: clara na escrita, escura na mesa, a cor do
 * modo leitor ou da Oficina quando estão abertos.
 */
/** Quanto a cor é opaca (0 a 1), em qualquer formato que o navegador devolva. */
function alpha(color: string): number {
  if (!color || color === 'transparent') return 0
  const slash = color.match(/\/\s*([\d.]+)(%?)\s*\)$/)
  if (slash) return Number(slash[1]) / (slash[2] ? 100 : 1)
  const rgba = color.match(/^rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)/)
  return rgba ? Number(rgba[1]) : 1
}

const solid = (color: string) => alpha(color) >= 0.9

/** A cor em #rrggbb (as barras do celular não entendem todos os formatos do CSS). */
function hex(color: string): string {
  try {
    const c = document.createElement('canvas')
    c.width = c.height = 1
    const ctx = c.getContext('2d', { willReadFrequently: true })
    if (!ctx) return color
    ctx.fillStyle = color
    ctx.fillRect(0, 0, 1, 1)
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
    return `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`
  } catch {
    return color
  }
}

/** A cor de fundo de quem está no alto da tela (subindo até achar um fundo de verdade). */
function topColor(): string {
  let el = document.elementFromPoint(innerWidth / 2, 2) as HTMLElement | null
  while (el) {
    const c = getComputedStyle(el).backgroundColor
    if (solid(c)) return c
    el = el.parentElement
  }
  return getComputedStyle(document.body).backgroundColor
}

export function followThemeColor() {
  if (typeof document === 'undefined') return
  let last = ''
  const paint = () => {
    const color = hex(topColor())
    if (!color || color === last) return
    last = color
    const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
    if (!metas.length) {
      const m = document.createElement('meta')
      m.name = 'theme-color'
      document.head.append(m)
    }
    document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
      m.removeAttribute('media')
      m.content = color
    })
  }
  // Depois de trocar de tela, abrir uma janela ou terminar uma animação de entrada.
  let timers: ReturnType<typeof setTimeout>[] = []
  const soon = () => {
    timers.forEach(clearTimeout)
    timers = [120, 650, 1700].map((ms) => setTimeout(paint, ms))
  }
  new MutationObserver(soon).observe(document.documentElement, { attributes: true })
  new MutationObserver(soon).observe(document.body, { attributes: true, childList: true })
  addEventListener('click', soon, true)
  addEventListener('popstate', soon)
  addEventListener('keyup', soon)
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', soon)
  document.addEventListener('visibilitychange', soon)
  soon()
}
