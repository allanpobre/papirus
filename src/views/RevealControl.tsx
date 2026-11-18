import { AlertTriangle, Eye } from 'lucide-react'
import { useState } from 'react'
import { cluesBefore } from '../logic/storyPoint'
import type { Entity } from '../model/schema'
import { byId, manuscriptOrder, patch, sceneTitle } from '../model/universe'
import { useWorkspace } from '../state/workspace'

/**
 * Jogo limpo: antes da revelação, o leitor teve alguma pista? Sem pista nem aparição antes, avisa
 * (a revelação chega do nada). Com pistas, diz quantas.
 */
function FairPlay({ entityIds, sceneId }: { entityIds: string[]; sceneId: string }) {
  const { universe } = useWorkspace()
  const order = manuscriptOrder(universe)
  const at = order.findIndex((s) => s.id === sceneId)
  if (at < 0) return null
  const { clues, scenes } = cluesBefore(universe, order, entityIds, at)
  if (!clues && !scenes)
    return (
      <p className="fair-play is-warn small" role="note">
        <AlertTriangle size={14} aria-hidden="true" /> Nenhuma pista antes desta cena: o leitor não tem como desconfiar. Para preparar, cite antes ou ligue uma pista em Trama › Pistas e mistérios.
      </p>
    )
  return (
    <p className="fair-play muted small" role="note">
      Antes desta cena, o leitor tem {[clues > 0 && `${clues} ${clues === 1 ? 'pista' : 'pistas'}`, scenes > 0 && `${scenes} ${scenes === 1 ? 'cena em que isso aparece' : 'cenas em que isso aparece'}`].filter(Boolean).join(' e ')}.
    </p>
  )
}

/** "O leitor só conhece esta ficha a partir de…": a ficha inteira fica escondida do leitor até a cena. */
export function EntityRevealField({ entity: e }: { entity: Entity }) {
  const { universe, update, readOnly } = useWorkspace()
  const order = manuscriptOrder(universe)
  if (!order.length) return null
  return (
    <div className="entity-reveal">
      <label className="field">
        <span className="field-label">
          <Eye size={14} aria-hidden="true" /> O leitor conhece esta ficha
        </span>
        <select
          className="input select"
          disabled={readOnly}
          value={e.reveal?.sceneId ?? ''}
          onChange={(ev) => update((u) => patch(u, 'entities', e.id, { reveal: ev.target.value ? { sceneId: ev.target.value } : undefined }))}
        >
          <option value="">Na primeira cena em que aparece</option>
          {order.map((s, i) => (
            <option key={s.id} value={s.id}>
              Só a partir de {i + 1}. {sceneTitle(s)}
            </option>
          ))}
        </select>
      </label>
      {e.reveal && <FairPlay entityIds={[e.id]} sceneId={e.reveal.sceneId} />}
    </div>
  )
}

/**
 * "O leitor descobre depois": a cena em que o leitor fica sabendo de uma ligação (a espécie verdadeira,
 * o pai de verdade) e o que ele vê até lá (outra opção, ou nada). O autor sempre vê a verdade.
 */
export function RevealControl({ relationId, masks, what }: { relationId: string; masks: Entity[]; what: string }) {
  const { universe, update, readOnly } = useWorkspace()
  const relation = byId(universe, 'relations', relationId)
  const reveal = relation?.reveal
  const [open, setOpen] = useState(false)
  if (!relation) return null
  const order = manuscriptOrder(universe)
  const at = reveal ? order.find((s) => s.id === reveal.sceneId) : undefined
  const mask = reveal?.maskId ? byId(universe, 'entities', reveal.maskId) : undefined
  const set = (next: { sceneId: string; maskId: string | null } | undefined) => update((u) => patch(u, 'relations', relationId, { reveal: next }))
  const label = reveal ? `O leitor descobre em “${at ? sceneTitle(at) : 'uma cena que não existe mais'}”${mask ? `; até lá, parece ${mask.name}` : ''}` : 'O leitor descobre depois…'

  return (
    <div className={`reveal-control${reveal ? ' is-set' : ''}`}>
      <button type="button" className="btn btn-ghost btn-sm reveal-toggle" aria-expanded={open} disabled={readOnly || !order.length} onClick={() => setOpen(!open)}>
        <Eye size={14} aria-hidden="true" /> {label}
      </button>
      {!order.length && <span className="muted tiny"> (escreva uma cena antes)</span>}
      {open && (
        <div className="reveal-panel" role="group" aria-label={`Quando o leitor descobre ${what}`}>
          <label className="field">
            <span className="field-label">O leitor descobre em</span>
            <select
              className="input select"
              value={reveal?.sceneId ?? ''}
              onChange={(ev) => set(ev.target.value ? { sceneId: ev.target.value, maskId: reveal?.maskId ?? null } : undefined)}
            >
              <option value="">Desde o começo (não é segredo)</option>
              {order.map((s, i) => (
                <option key={s.id} value={s.id}>
                  {i + 1}. {sceneTitle(s)}
                </option>
              ))}
            </select>
          </label>
          {reveal && (
            <label className="field">
              <span className="field-label">Até lá, o leitor vê</span>
              <select className="input select" value={reveal.maskId ?? ''} onChange={(ev) => set({ sceneId: reveal.sceneId, maskId: ev.target.value || null })}>
                <option value="">Nada (fica escondido)</option>
                {masks.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name || 'Sem nome'}
                  </option>
                ))}
              </select>
            </label>
          )}
          {reveal && relation && <FairPlay entityIds={[relation.toId]} sceneId={reveal.sceneId} />}
          <p className="muted tiny">Você sempre vê a verdade. Em “Ver como o leitor”, na wiki com limite e no link de leitura, quem lê vê {reveal?.maskId ? 'a máscara' : 'nada'} até essa cena.</p>
        </div>
      )}
    </div>
  )
}
