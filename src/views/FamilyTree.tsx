import { Maximize, Minus, Plus } from 'lucide-react'
import { useCallback, useMemo, useRef, useState } from 'react'
import { familyLayout, familyLinks, type FamilyLink, type FamilyNode } from '../logic/family'
import { fitView, revealBox, stageHeight } from '../logic/panZoom'
import { byId } from '../model/universe'
import { useWorkspace } from '../state/workspace'
import { usePanZoom } from '../ui/usePanZoom'

const W = 150
const H = 46
const GAP_X = 28
const GAP_Y = 70
/** Folga em volta do desenho, na escala 1. */
const MARGIN = 10
/** Largura da área antes de medir a tela (e nos testes sem tela). */
const FALLBACK_W = 340

/** A largura da área na tela, em pixels (o desenho usa 1 unidade = 1 pixel, então os nomes têm o mesmo tamanho em qualquer tela). */
function useElementWidth(): [(el: HTMLElement | null) => void, number | null] {
  const [width, setWidth] = useState<number | null>(null)
  const observer = useRef<ResizeObserver | null>(null)
  const ref = useCallback((el: HTMLElement | null) => {
    observer.current?.disconnect()
    observer.current = null
    if (!el) return
    const measure = () => {
      const w = Math.round(el.getBoundingClientRect().width)
      if (w > 0) setWidth((old) => (old === w ? old : w))
    }
    measure()
    if (typeof ResizeObserver !== 'undefined') {
      observer.current = new ResizeObserver(measure)
      observer.current.observe(el)
    }
  }, [])
  return [ref, width]
}

/**
 * Árvore da família, montada das relações. Toque numa pessoa para espiar a ficha. O desenho se mexe com o
 * dedo (arrastar, pinça), com a roda do mouse e com os botões + e −; abre inteiro se couber com a letra
 * legível, senão no menor tamanho legível, e “Enquadrar” mostra tudo.
 */
export function FamilyTree() {
  const { universe } = useWorkspace()
  const links = useMemo(() => familyLinks(universe), [universe])
  const { nodes } = useMemo(() => familyLayout(links), [links])
  if (!links.length)
    return (
      <p className="empty-inline">
        Nenhuma ligação de família ainda. Ligue as fichas com “pai de”, “filha de”, “casado com”, “irmã de”, “avô de”… e a árvore se monta sozinha.
      </p>
    )
  return <FamilyCanvas links={links} nodes={nodes} />
}

function FamilyCanvas({ links, nodes }: { links: FamilyLink[]; nodes: FamilyNode[] }) {
  const { universe, peek } = useWorkspace()
  const [wrapRef, measured] = useElementWidth()
  const width = measured ?? FALLBACK_W
  const at = new Map(nodes.map((n) => [n.id, { x: n.x * (W + GAP_X), y: n.gen * (H + GAP_Y) }]))
  const contentW = Math.max(...nodes.map((n) => at.get(n.id)!.x)) + W + 2 * MARGIN
  const contentH = Math.max(...nodes.map((n) => at.get(n.id)!.y)) + H + 2 * MARGIN
  // A área tem a altura do desenho aberto (no máximo, uma boa parte da tela).
  const maxH = Math.round(Math.min(560, (typeof innerHeight === 'number' ? innerHeight : 800) * 0.62))
  const height = stageHeight(width, contentW, contentH, maxH)
  const area = { width, height, contentW, contentH }
  const { gRef, svgProps, transform, view, setView, wasDrag, zoomBy, showAll } = usePanZoom(area, { minK: 0.25, maxK: 2.5 })
  const name = (id: string) => byId(universe, 'entities', id)?.name ?? '?'

  return (
    <div className="family-view">
      <div className="family-wrap family-stage" ref={wrapRef} style={{ height }}>
        <svg
          {...svgProps}
          className="family"
          width="100%"
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="group"
          aria-label={`Árvore da família com ${nodes.length} pessoas`}
        >
          <g ref={gRef} transform={transform}>
            <g transform={`translate(${MARGIN} ${MARGIN})`}>
              {links.map((l, i) => {
                const a = at.get(l.a)!
                const b = at.get(l.b)!
                if (l.kind === 'casal' || l.kind === 'irmaos') {
                  const [left, right] = a.x < b.x ? [a, b] : [b, a]
                  const y = left.y + H / 2
                  return <line key={i} className={`family-${l.kind}`} x1={left.x + W} y1={y} x2={right.x} y2={y} />
                }
                // Pai/mãe → filho: cotovelo.
                const x1 = a.x + W / 2
                const x2 = b.x + W / 2
                const y1 = a.y + H
                const y2 = b.y
                const mid = y1 + (y2 - y1) / 2
                return <path key={i} className={`family-${l.kind}`} d={`M${x1},${y1} V${mid} H${x2} V${y2}`} />
              })}
              {nodes.map((n) => {
                const p = at.get(n.id)!
                const e = byId(universe, 'entities', n.id)
                const years = e && (e.startYear !== null || e.endYear !== null) ? `${e.startYear ?? '?'}–${e.endYear ?? ''}` : ''
                return (
                  <g
                    key={n.id}
                    className="family-node"
                    transform={`translate(${p.x},${p.y})`}
                    role="button"
                    tabIndex={0}
                    aria-label={`${name(n.id)}${years ? `, ${years}` : ''}`}
                    // Um arrasto que começou na pessoa não é um toque nela.
                    onClick={() => !wasDrag() && peek(n.id)}
                    onKeyDown={(ev) => (ev.key === 'Enter' || ev.key === ' ') && peek(n.id)}
                    // Quem chega pelo teclado: o desenho anda só o preciso para ela aparecer.
                    onFocus={() => setView(revealBox(view, { x: p.x + MARGIN, y: p.y + MARGIN, w: W, h: H }, area))}
                  >
                    <rect width={W} height={H} rx={10} />
                    <text x={W / 2} y={years ? 20 : 28} textAnchor="middle" className="family-name">
                      {name(n.id).length > 20 ? `${name(n.id).slice(0, 19)}…` : name(n.id)}
                    </text>
                    {years && (
                      <text x={W / 2} y={36} textAnchor="middle" className="family-years">
                        {years}
                      </text>
                    )}
                  </g>
                )
              })}
            </g>
          </g>
        </svg>
        <div className="family-zoom">
          <button type="button" className="btn-icon" aria-label="Aproximar" onClick={() => zoomBy(1.25)}>
            <Plus size={16} />
          </button>
          <button type="button" className="btn-icon" aria-label="Afastar" onClick={() => zoomBy(1 / 1.25)}>
            <Minus size={16} />
          </button>
          <button type="button" className="btn-icon" aria-label="Enquadrar" onClick={() => showAll((a) => fitView(a))}>
            <Maximize size={16} />
          </button>
        </div>
      </div>
      <p className="muted tiny family-hint">Arraste para andar e aproxime com dois dedos (ou + e −). Toque numa pessoa para ver a ficha.</p>
      <p className="muted tiny family-legend">
        <span className="family-key family-key-casal" /> casal <span className="family-key family-key-irmaos" /> irmãos <span className="family-key family-key-pais" /> pais e filhos
      </p>
    </div>
  )
}
