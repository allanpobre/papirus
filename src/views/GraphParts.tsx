import { memo } from 'react'
import { useImageSrc } from '../images/resolve'
import { kindLabel } from '../model/labels'

/**
 * As peças do mapa de Ligações: cada bolinha e cada linha é um componente que só se desenha de novo
 * quando algo DELA muda. Passar o mouse numa ficha mexe em poucas peças (a ficha e quem está ligado
 * a ela); o "apagado" de todo o resto vem por CSS, da classe `has-focus` no desenho.
 * Por isso as peças só recebem números, textos e sim/não (nada de objetos novos a cada desenho).
 */

/** O que uma bolinha pode fazer. É um objeto único e estável (as peças nunca o veem mudar). */
export interface NodeActions {
  tap: (id: string) => void
  pick: (id: string) => void
  open: (id: string) => void
  enter: (id: string, pointerType: string) => void
  leave: (id: string, pointerType: string) => void
  focus: (id: string) => void
  blur: (id: string) => void
}

/** O retrato da ficha dentro da bolinha (se ela tem imagem); senão, a inicial. */
export function NodeFace({ id, name, image, r }: { id: string; name: string; image: string | null | undefined; r: number }) {
  const src = useImageSrc(image)
  if (src) {
    return (
      <>
        <clipPath id={`rosto-${id}`}>
          <circle r={r - 1.5} />
        </clipPath>
        <image className="node-face" href={src} x={-r} y={-r} width={2 * r} height={2 * r} preserveAspectRatio="xMidYMid slice" clipPath={`url(#rosto-${id})`} aria-hidden="true" />
      </>
    )
  }
  return (
    <text className="node-face node-initial" dy="0.36em" fontSize={Math.round(r * 0.95)} aria-hidden="true">
      {(name.trim()[0] ?? '?').toLocaleUpperCase('pt-BR')}
    </text>
  )
}

export interface NodeShapeProps {
  id: string
  name: string
  kind: string
  image: string | null | undefined
  /** A ordem de entrada (anima a chegada, uma depois da outra). */
  index: number
  x: number
  y: number
  r: number
  selected: boolean
  /** Fora da história neste ponto (sem ligação que valha na cena). */
  dim: boolean
  /** Apareceu agora, nesta cena. */
  isNew: boolean
  /** Está no grupo em destaque (a ficha sob o mouse e quem se liga a ela). */
  hl: boolean
  labelDx: number
  labelDy: number
  labelAnchor: 'middle' | 'start' | 'end'
  actions: NodeActions
}

export const NodeShape = memo(function NodeShape(p: NodeShapeProps) {
  const { id, actions } = p
  return (
    <g
      className={`node kind-${p.kind}${p.selected ? ' selected' : ''}${p.dim ? ' dim' : ''}${p.isNew ? ' is-new' : ''}${p.hl ? ' hl' : ''}`}
      style={{ ['--i' as string]: p.index }}
      transform={`translate(${p.x} ${p.y})`}
      tabIndex={0}
      role="button"
      aria-label={`${p.name}, ${kindLabel(p.kind)}`}
      onClick={() => actions.tap(id)}
      // Destacar ao passar por cima é só do mouse: no dedo, cada toque redesenharia tudo.
      onPointerEnter={(e) => actions.enter(id, e.pointerType)}
      onPointerLeave={(e) => actions.leave(id, e.pointerType)}
      onFocus={() => actions.focus(id)}
      onBlur={() => actions.blur(id)}
      onMouseDown={(e) => e.detail > 1 && e.preventDefault()}
      onDoubleClick={(e) => {
        e.preventDefault()
        getSelection()?.removeAllRanges()
        actions.open(id)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') actions.pick(id)
      }}
    >
      {p.selected && <circle r={p.r + 7} className="node-ring" />}
      <circle r={p.r} />
      <NodeFace id={id} name={p.name} image={p.image} r={p.r} />
      <text x={p.labelDx} y={p.labelDy} textAnchor={p.labelAnchor} className="node-label">
        {p.name}
      </text>
    </g>
  )
})

export interface EdgeShapeProps {
  /** 'derivada' ("fica em", campos de ficha) ou 'relacao'. */
  kind: 'derivada' | 'relacao'
  canon: string | undefined
  scoped: boolean
  /** Fora da cena: some (a ligação ainda não vale ou já deixou de valer). */
  off: boolean
  /** Entre as ligações da ficha em destaque. */
  lit: boolean
  label: string
  /** Quantas ligações desse par já têm o nome na linha (para empilhar os nomes sem encavalar). */
  row: number
  ax: number
  ay: number
  /** O ponto de chegada, já recuado para a seta não entrar na bolinha. */
  bx: number
  by: number
  /** O ponto de chegada sem o recuo (o nome fica no meio do caminho entre os centros). */
  cx: number
  cy: number
}

export const EdgeShape = memo(function EdgeShape(p: EdgeShapeProps) {
  return (
    <g className={`edge${p.kind === 'derivada' ? ' edge-derived' : ''}${p.off ? ' off' : ''}${p.lit ? ' lit hl' : ''}${p.canon && p.canon !== 'estabelecido' ? ` edge-${p.canon}` : ''}${p.scoped ? ' edge-scoped' : ''}`}>
      <path d={`M${p.ax},${p.ay} L${p.bx},${p.by}`} pathLength={p.kind === 'relacao' && p.canon !== 'rumor' ? 1 : undefined} markerEnd="url(#arrow)" />
      {p.lit && (
        // Duas ligações entre as mesmas fichas ("desconfia de" e "protege"): um nome em cima do outro, não por cima.
        <text x={(p.ax + p.cx) / 2} y={(p.ay + p.cy) / 2 - 5 - 15 * p.row} className="edge-label">
          {p.label}
        </text>
      )}
    </g>
  )
})

export interface ViaShapeProps {
  off: boolean
  lit: boolean
  label: string
  ax: number
  ay: number
  /** O meio da ligação principal, para onde aponta quem está por trás. */
  mx: number
  my: number
}

export const ViaShape = memo(function ViaShape(p: ViaShapeProps) {
  return (
    <g className={`edge edge-via${p.off ? ' off' : ''}${p.lit ? ' hl' : ''}`}>
      <path d={`M${p.ax},${p.ay} L${p.mx},${p.my}`} />
      <circle cx={p.mx} cy={p.my} r={3.5} className="edge-via-dot" />
      {p.lit && (
        <text x={(p.ax + p.mx) / 2} y={(p.ay + p.my) / 2 - 5} className="edge-label">
          {p.label}
        </text>
      )}
    </g>
  )
})
