import { Crown, Handshake, Plus, Swords, X } from 'lucide-react'
import { useState } from 'react'
import { answer, answerOf } from '../logic/kindQuestions'
import { rulersOf, TENSION_LEVELS, tensionsOf, tradesOf } from '../logic/power'
import type { Entity } from '../model/schema'
import { draftRelation, insert, patch, remove } from '../model/universe'
import { useWorkspace } from '../state/workspace'
import { EntityPicker } from '../ui/EntityPicker'
import { Fold } from '../ui/Fold'
import { DominoDialog } from './DominoDialog'

const KINDS = ['lugar', 'reino', 'faccao', 'cultura', 'especie', 'religiao']
const PLACES = ['lugar', 'reino']

/**
 * Poder e tensões de um lugar ou grupo: quem manda (com "E se cair?", o dominó), o que produz e precisa
 * (com o comércio que isso sugere) e as tensões com os outros num medidor de três passos.
 */
export function PowerPanel({ entity: e }: { entity: Entity }) {
  const { universe, update, go, toast, undoable } = useWorkspace()
  const [falls, setFalls] = useState<Entity | null>(null)
  if (!KINDS.includes(e.kind)) return null
  const rulers = PLACES.includes(e.kind) ? rulersOf(universe, e.id) : []
  const tensions = tensionsOf(universe, e.id)
  const trades = tradesOf(universe, e.id)
  const field = (k: string) => answerOf(e.fields, k)
  const setField = (k: string, v: string) => update((u) => patch(u, 'entities', e.id, { fields: answer(e.fields, k, v) }))
  const link = (fromId: string, toId: string, type: string, note = '') => update((u) => insert(u, 'relations', { ...draftRelation(fromId, toId, type), note })[0])
  const hot = tensions.filter((t) => t.level !== 'paz').length
  return (
    <div className="power-panel">
      <Fold id="ficha-poder" title={`Poder e tensões${hot ? ` (${hot} ${hot === 1 ? 'tensão' : 'tensões'})` : ''}`} defaultOpen={rulers.length > 0 || tensions.length > 0 || Boolean(field('Produz') || field('Precisa'))}>
        {PLACES.includes(e.kind) && (
          <>
            <h4 className="lang-h">
              <Crown size={14} aria-hidden="true" /> Quem manda
            </h4>
            {rulers.map((r) => (
              <div key={r.relation.id} className="power-ruler">
                <button type="button" className="link-btn" onClick={() => go('fichas', r.entity.id)}>
                  {r.entity.name}
                </button>
                <span className="muted small">{r.relation.type}</span>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFalls(r.entity)}>
                  E se cair?
                </button>
              </div>
            ))}
            <EntityPicker label="Quem governa aqui" value={null} kinds={['personagem', 'faccao', 'reino']} exclude={[e.id, ...rulers.map((r) => r.entity.id)]} placeholder="Um regente, um conselho, uma guilda…" onChange={(id) => id && link(id, e.id, 'governa')} />
          </>
        )}

        <h4 className="lang-h">
          <Handshake size={14} aria-hidden="true" /> O que produz e o que precisa
        </h4>
        <div className="inline-fields">
          <label className="small power-goods">
            Produz
            <input className="input" placeholder="sal, peixe, ferro" value={field('Produz')} onChange={(ev) => setField('Produz', ev.target.value)} />
          </label>
          <label className="small power-goods">
            Precisa
            <input className="input" placeholder="madeira, trigo" value={field('Precisa')} onChange={(ev) => setField('Precisa', ev.target.value)} />
          </label>
        </div>
        {trades.length > 0 && (
          <ul className="power-trades small" aria-label="Comércio possível">
            {trades.map((t, i) => (
              <li key={i}>
                <span>
                  <strong>{t.from.name}</strong> produz {t.good}, que <strong>{t.to.name}</strong> precisa.
                </span>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    link(t.from.id, t.to.id, 'comercia com', t.good)
                    toast('Rota de comércio criada (em Ligações).')
                  }}
                >
                  Comerciar
                </button>
              </li>
            ))}
          </ul>
        )}

        <h4 className="lang-h">
          <Swords size={14} aria-hidden="true" /> Tensões
        </h4>
        {tensions.map((t) => {
          const other = t.a.id === e.id ? t.b : t.a
          return (
            <div key={t.relation.id} className={`power-tension is-${t.level}`}>
              <button type="button" className="link-btn" onClick={() => go('fichas', other.id)}>
                {other.name}
              </button>
              <div className="power-meter" role="radiogroup" aria-label={`Tensão com ${other.name}`}>
                {TENSION_LEVELS.map((l) => (
                  <button key={l.id} type="button" role="radio" aria-checked={t.level === l.id} className={`power-step is-${l.id}`} onClick={() => update((u) => patch(u, 'relations', t.relation.id, { type: l.type }))}>
                    {l.label}
                  </button>
                ))}
              </div>
              <button type="button" className="btn btn-ghost btn-sm" aria-label={`Tirar a tensão com ${other.name}`} onClick={() => undoable(`Tensão com ${other.name} tirada`, (u) => remove(u, 'relations', t.relation.id))}>
                <X size={13} aria-hidden="true" />
              </button>
            </div>
          )
        })}
        <EntityPicker
          label="Nova tensão com"
          value={null}
          kinds={KINDS.concat('personagem')}
          exclude={[e.id, ...tensions.map((t) => (t.a.id === e.id ? t.b.id : t.a.id))]}
          placeholder="Um rival, um vizinho…"
          onChange={(id) => id && link(e.id, id, 'em tensão com')}
        />
        <p className="tiny muted">
          <Plus size={11} aria-hidden="true" /> As tensões aparecem no mapa (camada “Tensões”) quando os dois têm lugar ou região nele.
        </p>
      </Fold>
      {falls && <DominoDialog entity={falls} onClose={() => setFalls(null)} />}
    </div>
  )
}
