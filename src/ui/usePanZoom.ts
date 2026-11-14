import { useEffect, useRef, useState } from 'react'
import { clampView, openingView, zoomAt, type Area, type PanZoomView } from '../logic/panZoom'

/**
 * Mover (um dedo ou o mouse), aproximar (dois dedos ou a roda) e guardar onde parou, num desenho
 * SVG. É a mesma técnica leve das Ligações: durante o gesto o desenho se move direto, sem passar
 * pelo React (um quadro por vez); a vista só é guardada ao soltar. Um arrasto que começa em cima
 * de um item não vira toque nele (`moved`).
 *
 * O desenho vai dentro de um `<g ref={gRef} transform={transform}>`, e o `<svg>` recebe `svgProps`.
 */
export function usePanZoom(area: Area, { minK = 0.3, maxK = 3, pad = 12 } = {}) {
  const { width, height, contentW, contentH } = area
  // A vista de abrir muda com o tamanho da tela (ou do desenho): nesse caso, volta a abrir.
  const key = `${width}|${height}|${contentW}|${contentH}`
  const [state, setState] = useState(() => ({ key, view: openingView(area, pad) }))
  if (state.key !== key) setState({ key, view: openingView(area, pad) })
  const view = state.view
  const setView = (v: PanZoomView) => setState((s) => ({ ...s, view: v }))

  const svgRef = useRef<SVGSVGElement>(null)
  const gRef = useRef<SVGGElement>(null)
  const live = useRef<PanZoomView | null>(null)
  const frame = useRef(0)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const drag = useRef<{ x: number; y: number; vx: number; vy: number; moved: boolean } | null>(null)
  const pinch = useRef<{ d: number; view: PanZoomView; fx: number; fy: number } | null>(null)
  /** O gesto atual já é arrasto ou pinça: ao soltar, não conta como toque. */
  const moved = useRef(false)
  const latest = useRef({ area, view, minK, maxK })
  useEffect(() => {
    latest.current = { area, view, minK, maxK }
  })

  const transformOf = (v: PanZoomView) => `translate(${v.x} ${v.y}) scale(${v.k})`
  const show = (next: PanZoomView) => {
    live.current = next
    if (frame.current) return
    frame.current = requestAnimationFrame(() => {
      frame.current = 0
      if (live.current) gRef.current?.setAttribute('transform', transformOf(live.current))
    })
  }
  const commit = () => {
    if (frame.current) cancelAnimationFrame(frame.current)
    frame.current = 0
    if (live.current) setView(live.current)
    live.current = null
  }
  /** Pixels da tela para unidades do desenho (1 unidade = 1 pixel, salvo se o navegador der largura 0). */
  const local = (clientX: number, clientY: number) => {
    const r = svgRef.current?.getBoundingClientRect()
    if (!r || !(r.width > 0)) return null
    const s = latest.current.area.width / r.width
    return { x: (clientX - r.left) * s, y: (clientY - r.top) * s, scale: s }
  }
  const current = () => live.current ?? latest.current.view
  const fit = (v: PanZoomView) => clampView(v, latest.current.area)

  const endPointer = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinch.current = null
    if (pointers.current.size === 0) {
      drag.current = null
      commit()
    }
  }

  // A roda do mouse aproxima em volta do ponteiro, sem rolar a página por trás.
  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const p = local(e.clientX, e.clientY)
      if (!p) return
      const { minK, maxK } = latest.current
      setView(fit(zoomAt(current(), e.deltaY < 0 ? 1.1 : 0.9, p.x, p.y, minK, maxK)))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  })

  const svgProps = {
    ref: svgRef,
    onPointerDown: (e: React.PointerEvent) => {
      // Arrastar o desenho nunca seleciona texto.
      e.preventDefault()
      getSelection()?.removeAllRanges()
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
      const now = current()
      if (pointers.current.size === 2) {
        const [a, b] = [...pointers.current.values()]
        const mid = local((a.x + b.x) / 2, (a.y + b.y) / 2)
        pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, view: now, fx: mid?.x ?? 0, fy: mid?.y ?? 0 }
        drag.current = null
        moved.current = true
        return
      }
      // Vale começar o arrasto em cima de um item: só vira arrasto se o dedo andar.
      moved.current = false
      drag.current = { x: e.clientX, y: e.clientY, vx: now.x, vy: now.y, moved: false }
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (pinch.current && pointers.current.size === 2) {
        const [a, b] = [...pointers.current.values()]
        const mid = local((a.x + b.x) / 2, (a.y + b.y) / 2)
        if (!mid) return
        const { minK, maxK } = latest.current
        const p = pinch.current
        const factor = Math.hypot(a.x - b.x, a.y - b.y) / p.d
        // O ponto do desenho que estava entre os dedos continua entre eles, mesmo se eles andarem.
        const z = zoomAt(p.view, factor, p.fx, p.fy, minK, maxK)
        if (Number.isFinite(z.k)) show(fit({ k: z.k, x: z.x + (mid.x - p.fx), y: z.y + (mid.y - p.fy) }))
        return
      }
      const d = drag.current
      if (!d) return
      if (!d.moved) {
        if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < 8) return
        d.moved = true
        moved.current = true
        ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
      }
      const p = local(e.clientX, e.clientY)
      if (!p) return
      const v = current()
      const x = d.vx + (e.clientX - d.x) * p.scale
      const y = d.vy + (e.clientY - d.y) * p.scale
      if (Number.isFinite(x) && Number.isFinite(y)) show(fit({ ...v, x, y }))
    },
    onPointerUp: endPointer,
    onPointerCancel: endPointer,
    // Ao começar o arrasto, o navegador solta a captura que o toque tinha no item de baixo (e avisa por aqui, de dentro
    // do desenho): isso não é o fim do gesto. Só vale quando é o próprio desenho que perdeu a captura.
    onLostPointerCapture: (e: React.PointerEvent) => {
      if (e.target === e.currentTarget) endPointer(e)
    },
  }

  return {
    view,
    setView: (v: PanZoomView) => setView(fit(v)),
    svgRef,
    gRef,
    svgProps,
    /** O gesto que acabou foi arrasto ou pinça (e então não vale como toque num item)? */
    wasDrag: () => moved.current,
    /** O valor de `transform` do `<g>` do desenho. */
    transform: transformOf(view),
    /** Aproxima (>1) ou afasta (<1) em volta do meio da tela. */
    zoomBy: (f: number) => setView(fit(zoomAt(current(), f, width / 2, height / 2, minK, maxK))),
    /** Volta à vista de abrir. */
    reset: () => setView(openingView(area, pad)),
    /** A vista que mostra o desenho inteiro (pode ficar pequena demais para ler). */
    showAll: (fitFn: (a: Area) => PanZoomView) => setView(fitFn(area)),
  }
}
