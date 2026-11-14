import { useEffect, useLayoutEffect, useRef } from 'react'

/**
 * Mover e aproximar uma imagem grande dentro de uma área com rolagem, pelo toque (o mouse segue com a rolagem e as
 * barras de sempre). É a técnica leve das Ligações: um dedo arrasta a rolagem direto (sem passar pelo React) e
 * dois dedos aproximam com uma pré-visualização (`transform`) que só vira o zoom de verdade ao soltar; aí o
 * ponto que estava entre os dedos volta para debaixo deles. Um arrasto que começa em cima de um marcador não
 * conta como toque nele (`wasDrag`).
 *
 * A área (`scrollRef`) precisa de `touch-action: none` e de `overflow: auto`; a imagem (`imgRef`) tem a largura do zoom.
 */
export function useScrollPinch(zoom: number, setZoom: (z: number) => void, { minZoom = 1, maxZoom = 4 } = {}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLDivElement>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pan = useRef<{ x: number; y: number; left: number; top: number; moved: boolean } | null>(null)
  const pinch = useRef<{ d: number; fx: number; fy: number; s: number; mx: number; my: number } | null>(null)
  /** O gesto atual já é arrasto ou pinça: ao soltar, não vale como toque. */
  const moved = useRef(false)
  const pending = useRef<{ fx: number; fy: number; cx: number; cy: number } | null>(null)
  const latest = useRef({ zoom, setZoom, minZoom, maxZoom })
  useEffect(() => {
    latest.current = { zoom, setZoom, minZoom, maxZoom }
  })

  // A imagem já tem o tamanho novo: o ponto que estava entre os dedos volta para debaixo deles.
  useLayoutEffect(() => {
    const p = pending.current
    pending.current = null
    const sc = scrollRef.current
    const img = imgRef.current
    if (!p || !sc || !img) return
    sc.scrollLeft = p.fx * img.offsetWidth - p.cx
    sc.scrollTop = p.fy * img.offsetHeight - p.cy
  }, [zoom])

  const touch = (e: React.PointerEvent) => e.pointerType !== 'mouse'

  const finish = () => {
    const p = pinch.current
    pinch.current = null
    const img = imgRef.current
    const sc = scrollRef.current
    if (img) {
      img.style.transform = ''
      img.style.transformOrigin = ''
    }
    if (!p || !img || !sc || p.s === 1) return
    const { zoom, setZoom, minZoom, maxZoom } = latest.current
    const next = Math.min(maxZoom, Math.max(minZoom, zoom * p.s))
    if (next === zoom) return
    const r = sc.getBoundingClientRect()
    pending.current = { fx: p.fx, fy: p.fy, cx: p.mx - r.left, cy: p.my - r.top }
    setZoom(next)
  }
  const end = (e: React.PointerEvent) => {
    if (!touch(e)) return
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2 && pinch.current) finish()
    if (pointers.current.size === 0) pan.current = null
  }

  return {
    scrollRef,
    imgRef,
    wasDrag: () => moved.current,
    bind: {
      onPointerDown: (e: React.PointerEvent) => {
        // Todo gesto novo começa sem ser arrasto (o último, de dedo, pode ter deixado `moved` ligado).
        if (!touch(e)) {
          moved.current = false
          return
        }
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
        const sc = scrollRef.current
        const img = imgRef.current
        if (!sc || !img) return
        if (pointers.current.size === 2) {
          const [a, b] = [...pointers.current.values()]
          const mx = (a.x + b.x) / 2
          const my = (a.y + b.y) / 2
          const r = img.getBoundingClientRect()
          pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, fx: (mx - r.left) / r.width, fy: (my - r.top) / r.height, s: 1, mx, my }
          img.style.transformOrigin = `${mx - r.left}px ${my - r.top}px`
          pan.current = null
          moved.current = true
          return
        }
        moved.current = false
        pan.current = { x: e.clientX, y: e.clientY, left: sc.scrollLeft, top: sc.scrollTop, moved: false }
      },
      onPointerMove: (e: React.PointerEvent) => {
        if (!touch(e)) return
        if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
        const img = imgRef.current
        const p = pinch.current
        if (p && img && pointers.current.size === 2) {
          const [a, b] = [...pointers.current.values()]
          const { zoom, minZoom, maxZoom } = latest.current
          const s = Math.min(maxZoom / zoom, Math.max(minZoom / zoom, Math.hypot(a.x - b.x, a.y - b.y) / p.d))
          if (!Number.isFinite(s)) return
          p.s = s
          p.mx = (a.x + b.x) / 2
          p.my = (a.y + b.y) / 2
          img.style.transform = `scale(${s})`
          return
        }
        const d = pan.current
        const sc = scrollRef.current
        if (!d || !sc) return
        if (!d.moved) {
          if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < 8) return
          d.moved = true
          moved.current = true
          try {
            ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
          } catch {
            // Um toque que o navegador já não conhece (acabou no meio do gesto): segue sem a captura.
          }
        }
        sc.scrollLeft = d.left - (e.clientX - d.x)
        sc.scrollTop = d.top - (e.clientY - d.y)
      },
      onPointerUp: end,
      onPointerCancel: end,
      // Começar o arrasto solta a captura que o toque tinha no marcador de baixo (o aviso sobe até aqui): isso não é o fim do gesto.
      onLostPointerCapture: (e: React.PointerEvent) => {
        if (e.target === e.currentTarget) end(e)
      },
    },
  }
}
