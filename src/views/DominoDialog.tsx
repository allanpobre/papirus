import { useMemo } from 'react'
import { domino } from '../logic/domino'
import { kindLabel } from '../model/labels'
import type { Entity } from '../model/schema'
import { useWorkspace } from '../state/workspace'
import { Modal } from '../ui/Modal'

/** Efeito dominó: "e se esta ficha sumir?", seguindo as ligações. Só mostra; não muda nada. */
export function DominoDialog({ entity, onClose }: { entity: Entity; onClose: () => void }) {
  const { universe, go } = useWorkspace()
  const d = useMemo(() => domino(universe, entity.id), [universe, entity.id])
  const open = (id: string) => {
    onClose()
    go('fichas', id)
  }
  const name = entity.name || 'Sem nome'
  const empty = d.groups.length === 0

  return (
    <Modal title={`E se ${name} sumir?`} onClose={onClose} size="sm">
      <div className="domino">
        {empty ? (
          <p className="muted">Nada cai: {name} ainda não tem ligações. Ligue a alguém, a um lugar ou a uma facção, e o dominó aparece aqui.</p>
        ) : (
          <>
            <p className="muted small">Só uma simulação: nada muda no mundo. Bom para planejar uma reviravolta.</p>
            {d.groups.map((g) => (
              <section key={g.key} className="domino-group">
                <h3>{g.title}</h3>
                <ul>
                  {g.items.map(({ entity: x, why }) => (
                    <li key={x.id}>
                      <button type="button" className="link-btn" onClick={() => open(x.id)}>
                        {x.name || 'Sem nome'}
                      </button>{' '}
                      <span className="muted small">
                        {kindLabel(x.kind).toLocaleLowerCase('pt-BR')} · {why}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            {d.heirs.length > 0 && (
              <section className="domino-group domino-heirs">
                <h3>Quem poderia assumir</h3>
                <p>
                  {d.heirs.map((h, i) => (
                    <span key={h.id}>
                      {i > 0 && ', '}
                      <button type="button" className="link-btn" onClick={() => open(h.id)}>
                        {h.name}
                      </button>
                    </span>
                  ))}
                </p>
              </section>
            )}
            {d.ripple.length > 0 && (
              <section className="domino-group">
                <h3>Na segunda onda</h3>
                <p className="small">{d.ripple.map((x) => x.name).join(' · ')}</p>
              </section>
            )}
          </>
        )}
        {(d.scenes > 0 || d.facts > 0) && (
          <p className="muted small">
            {name} aparece em {d.scenes} {d.scenes === 1 ? 'cena' : 'cenas'}
            {d.facts > 0 && ` e em ${d.facts} ${d.facts === 1 ? 'fato' : 'fatos'}`}: tudo isso muda junto.
          </p>
        )}
      </div>
    </Modal>
  )
}
