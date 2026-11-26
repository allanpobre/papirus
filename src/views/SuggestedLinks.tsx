import { Link2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { suggestLinks, type SuggestedLink } from '../logic/suggestLinks'
import { draftRelation, insert } from '../model/universe'
import { recall, remember } from '../state/prefs'
import { useWorkspace } from '../state/workspace'
import { Modal } from '../ui/Modal'

/*
 * “Achei N ligações escritas nas suas fichas” (auditoria 26, Duda): quem trouxe notas com “Irmão de [[Mira]]” vê a
 * proposta e aceita uma por uma, ou todas. As que o autor desmarca não voltam a ser propostas (neste aparelho).
 */
const keyOf = (s: SuggestedLink) => `${s.fromId}>${s.toId}>${s.type}`

export function SuggestedLinks() {
  const { universe, undoable, readOnly } = useWorkspace()
  const storeKey = `ligacoes-recusadas:${universe.id}`
  const [refused, setRefused] = useState<string[]>(() => {
    try {
      return JSON.parse(recall(storeKey) ?? '[]') as string[]
    } catch {
      return []
    }
  })
  const all = useMemo(() => suggestLinks(universe).filter((s) => !refused.includes(keyOf(s))), [universe, refused])
  const [open, setOpen] = useState(false)
  const [off, setOff] = useState<Set<string>>(new Set())
  if (readOnly || all.length === 0) return null
  const name = (id: string) => universe.entities.find((e) => e.id === id)?.name ?? '?'
  const chosen = all.filter((s) => !off.has(keyOf(s)))
  return (
    <>
      <div className="suggested-links" role="region" aria-label="Ligações achadas no texto">
        <Link2 size={16} aria-hidden="true" />
        <span className="small">
          Achei <strong>{all.length === 1 ? '1 ligação' : `${all.length} ligações`}</strong> escritas nas suas fichas (como “irmão de” ou “serve a”).
        </span>
        <button type="button" className="btn btn-sm btn-primary" onClick={() => setOpen(true)}>
          Ver e aceitar
        </button>
      </div>
      {open && (
        <Modal
          title="Ligações achadas no texto"
          about="O Papirus leu o resumo, a descrição e os campos das fichas e achou frases como “Irmão de Mira”. Nada vira ligação sem o seu toque; as que você desmarcar não voltam a aparecer."
          onClose={() => setOpen(false)}
          footer={
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
                Agora não
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={chosen.length === 0}
                onClick={() => {
                  const recusadas = all.filter((s) => off.has(keyOf(s))).map(keyOf)
                  if (recusadas.length) {
                    const next = [...refused, ...recusadas]
                    setRefused(next)
                    remember(storeKey, JSON.stringify(next))
                  }
                  undoable(chosen.length === 1 ? '1 ligação criada' : `${chosen.length} ligações criadas`, (u) =>
                    chosen.reduce((acc, s) => insert(acc, 'relations', draftRelation(s.fromId, s.toId, s.type))[0], u),
                  )
                  setOpen(false)
                  setOff(new Set())
                }}
              >
                {chosen.length === 1 ? 'Criar 1 ligação' : `Criar ${chosen.length} ligações`}
              </button>
            </>
          }
        >
          <ul className="suggested-list">
            {all.map((s) => (
              <li key={keyOf(s)}>
                <label>
                  <input
                    type="checkbox"
                    checked={!off.has(keyOf(s))}
                    onChange={() =>
                      setOff((o) => {
                        const n = new Set(o)
                        if (n.has(keyOf(s))) n.delete(keyOf(s))
                        else n.add(keyOf(s))
                        return n
                      })
                    }
                  />
                  <span>
                    <strong>{name(s.fromId)}</strong> {s.type} <strong>{name(s.toId)}</strong>
                    <span className="tiny muted suggested-quote">“{s.quote}”</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </Modal>
      )}
    </>
  )
}
