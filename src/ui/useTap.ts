import { useRef } from 'react'

/*
 * Toque parado num item de um desenho que se arrasta (mapa, árvore): vale ao levantar o dedo, sem esperar o
 * clique. Logo depois de arrastar, o navegador do celular engole o clique (acha que o toque é para parar a
 * rolagem) e o item não abria. Com o mouse, continua o clique de sempre.
 */
export function useTap(wasDrag: () => boolean) {
  const down = useRef<{ id: number; x: number; y: number } | null>(null)
  const tappedAt = useRef(0)
  return (onTap: () => void) => ({
    onPointerDown: (ev: React.PointerEvent) => {
      down.current = ev.pointerType === 'mouse' ? null : { id: ev.pointerId, x: ev.clientX, y: ev.clientY }
    },
    onPointerUp: (ev: React.PointerEvent) => {
      const d = down.current
      down.current = null
      if (ev.pointerType === 'mouse' || d?.id !== ev.pointerId || wasDrag() || Math.hypot(ev.clientX - d.x, ev.clientY - d.y) >= 8) return
      tappedAt.current = Date.now()
      onTap()
    },
    onClick: () => {
      // O clique que vem depois do toque já tratado não conta de novo.
      if (Date.now() - tappedAt.current < 700) return
      if (!wasDrag()) onTap()
    },
  })
}
