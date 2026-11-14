import { useEffect, useRef, useState } from 'react'
import { Modal } from '../ui/Modal'
import { isWhole, moveRect, resizeRect, squareRect, wholeRect, type Handle, type Rect } from './crop'

const VIEW = 288 // o lado do quadrado do retrato, em pixels da tela
const FREE_MAX = 320 // o maior lado da imagem na tela, no recorte livre

/**
 * Recortar antes de guardar. Retrato (`square`): a imagem anda e dá zoom dentro de um quadrado (arrasta com o dedo, pinça
 * ou o controle de zoom). Mapa (livre): o retângulo se arrasta e as bordas e cantos o redimensionam. "Sem recortar" usa a imagem toda.
 */
export function CropDialog({ file, square, title, onDone, onCancel }: { file: Blob; square: boolean; title: string; onDone: (crop: Rect | undefined) => void; onCancel: () => void }) {
  const [url, setUrl] = useState<string | null>(null)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  // A imagem entra como endereço de dados (sem URL para soltar depois), lida do arquivo.
  useEffect(() => {
    let off = false
    const reader = new FileReader()
    reader.onload = () => !off && setUrl(String(reader.result))
    reader.onerror = () => !off && onCancel()
    reader.readAsDataURL(file)
    return () => {
      off = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file])

  return (
    <Modal title={title} size="sm" onClose={onCancel} restoreFocus={false}>
      <div className="crop">
        {url && <img className="crop-probe" src={url} alt="" onLoad={(e) => setSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} onError={() => onCancel()} />}
        {!size ? (
          <p className="muted small">Abrindo a imagem…</p>
        ) : square ? (
          <SquareCrop url={url!} size={size} onDone={onDone} onCancel={onCancel} />
        ) : (
          <FreeCrop url={url!} size={size} onDone={onDone} onCancel={onCancel} />
        )}
      </div>
    </Modal>
  )
}

function Actions({ onWhole, onUse, onCancel, whole }: { onWhole: () => void; onUse: () => void; onCancel: () => void; whole: boolean }) {
  return (
    <div className="crop-actions">
      <button type="button" className="btn btn-primary" onClick={onUse}>
        {whole ? 'Usar a imagem' : 'Usar este recorte'}
      </button>
      <button type="button" className="btn btn-ghost" onClick={onWhole}>
        Sem recortar
      </button>
      <button type="button" className="btn btn-ghost" onClick={onCancel}>
        Cancelar
      </button>
    </div>
  )
}

/** Retrato: a imagem se move dentro de um quadrado fixo. Um dedo arrasta; dois dedos fazem zoom. */
function SquareCrop({ url, size, onDone, onCancel }: { url: string; size: { w: number; h: number }; onDone: (c: Rect | undefined) => void; onCancel: () => void }) {
  const [zoom, setZoom] = useState(1)
  const [center, setCenter] = useState({ x: size.w / 2, y: size.h / 2 })
  const rect = squareRect(size.w, size.h, zoom, center.x, center.y)
  const scale = VIEW / rect.w // pixels da tela por pixel da imagem
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<{ dist: number; zoom: number } | null>(null)
  const maxZoom = Math.max(2, Math.min(size.w, size.h) / 32)

  const onDown = (e: React.PointerEvent) => {
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom }
    }
  }
  const onMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId)
    if (!prev) return
    const now = { x: e.clientX, y: e.clientY }
    pointers.current.set(e.pointerId, now)
    if (pointers.current.size >= 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      if (pinch.current.dist > 0) setZoom(Math.min(maxZoom, Math.max(1, (pinch.current.zoom * dist) / pinch.current.dist)))
      return
    }
    // Um dedo: a imagem acompanha o dedo (o centro anda no sentido contrário).
    setCenter((c) => ({ x: c.x - (now.x - prev.x) / scale, y: c.y - (now.y - prev.y) / scale }))
  }
  const onUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinch.current = null
  }

  return (
    <>
      <div
        className="crop-square"
        style={{ width: VIEW, height: VIEW }}
        role="img"
        aria-label="Área do retrato: arraste para enquadrar"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onWheel={(e) => setZoom((z) => Math.min(maxZoom, Math.max(1, z * (e.deltaY < 0 ? 1.1 : 0.9))))}
      >
        <img src={url} alt="" draggable={false} style={{ width: size.w * scale, height: size.h * scale, transform: `translate(${-rect.x * scale}px, ${-rect.y * scale}px)` }} />
      </div>
      <label className="crop-zoom">
        <span className="small">Zoom</span>
        <input type="range" min={1} max={maxZoom} step={0.05} value={zoom} aria-label="Zoom do retrato" onChange={(e) => setZoom(Number(e.target.value))} />
      </label>
      <p className="muted tiny">Arraste para enquadrar; com dois dedos (ou o controle), aproxime.</p>
      <Actions whole={false} onUse={() => onDone(rect)} onWhole={() => onDone(undefined)} onCancel={onCancel} />
    </>
  )
}

/** Mapa: um retângulo livre sobre a imagem. */
function FreeCrop({ url, size, onDone, onCancel }: { url: string; size: { w: number; h: number }; onDone: (c: Rect | undefined) => void; onCancel: () => void }) {
  const scale = Math.min(1, FREE_MAX / Math.max(size.w, size.h))
  const [rect, setRect] = useState<Rect>(wholeRect(size.w, size.h))
  const drag = useRef<{ x: number; y: number; start: Rect; what: Handle | 'move' } | null>(null)
  const whole = isWhole(rect, size.w, size.h)

  const start = (what: Handle | 'move') => (e: React.PointerEvent) => {
    e.stopPropagation()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY, start: rect, what }
  }
  const move = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    const dx = (e.clientX - d.x) / scale
    const dy = (e.clientY - d.y) / scale
    setRect(d.what === 'move' ? moveRect(d.start, dx, dy, size.w, size.h) : resizeRect(d.start, d.what, dx, dy, size.w, size.h))
  }
  const end = () => {
    drag.current = null
  }
  const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
  const LABEL: Record<Handle, string> = { n: 'a borda de cima', s: 'a borda de baixo', e: 'a borda da direita', w: 'a borda da esquerda', ne: 'o canto de cima à direita', nw: 'o canto de cima à esquerda', se: 'o canto de baixo à direita', sw: 'o canto de baixo à esquerda' }

  return (
    <>
      <div className="crop-free" style={{ width: size.w * scale, height: size.h * scale }}>
        <img src={url} alt="" draggable={false} style={{ width: '100%', height: '100%' }} />
        <div
          className="crop-box"
          role="group"
          aria-label="Área do recorte: arraste para mover"
          style={{ left: rect.x * scale, top: rect.y * scale, width: rect.w * scale, height: rect.h * scale }}
          onPointerDown={start('move')}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
        >
          {HANDLES.map((h) => (
            <span key={h} className={`crop-handle crop-handle-${h}`} role="button" aria-label={`Arrastar ${LABEL[h]}`} onPointerDown={start(h)} onPointerMove={move} onPointerUp={end} onPointerCancel={end} />
          ))}
        </div>
      </div>
      <p className="muted tiny">
        Recorte livre: arraste o retângulo ou as bordas. {whole ? 'Agora vale a imagem toda.' : `Fica ${Math.round(rect.w)} × ${Math.round(rect.h)} px.`}
      </p>
      <Actions whole={whole} onUse={() => onDone(whole ? undefined : rect)} onWhole={() => onDone(undefined)} onCancel={onCancel} />
    </>
  )
}
