import { Eye } from 'lucide-react'
import { useState } from 'react'
import type { Entity } from '../model/schema'
import { byId, manuscriptOrder, patch, sceneTitle } from '../model/universe'
import { useWorkspace } from '../state/workspace'

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
          <p className="muted tiny">Você sempre vê a verdade. Em “Ver como o leitor”, na wiki com limite e no link de leitura, quem lê vê {reveal?.maskId ? 'a máscara' : 'nada'} até essa cena.</p>
        </div>
      )}
    </div>
  )
}
