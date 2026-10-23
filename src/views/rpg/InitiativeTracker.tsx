import { ChevronRight, Plus, RotateCcw, X } from 'lucide-react'
import { useState } from 'react'
import { roll } from '../../logic/dice'
import type { Session } from '../../model/schema'
import { newId, patch } from '../../model/universe'
import { useWorkspace } from '../../state/workspace'

/** Ordem de iniciativa da sessão, com vez atual e anotações rápidas (PV, condições). */
export function InitiativeTracker({ session }: { session: Session }) {
  const { update } = useWorkspace()
  const [name, setName] = useState('')
  const [value, setValue] = useState('')
  const [turn, setTurn] = useState(0)
  const list = [...session.initiative].sort((a, b) => b.value - a.value)
  const set = (initiative: Session['initiative']) => update((u) => patch(u, 'sessions', session.id, { initiative }))

  const add = () => {
    if (!name.trim()) return
    const v = value.trim() ? Number(value) : roll('d20').total
    if (!Number.isFinite(v)) return
    set([...session.initiative, { id: newId(), name: name.trim(), value: v, hp: '', note: '' }])
    setName('')
    setValue('')
  }

  return (
    <section className="initiative">
      <div className="section-head">
        <h2 className="section-title">Iniciativa</h2>
        {list.length > 0 && (
          <div className="inline-fields">
            <button type="button" className="btn btn-sm btn-primary" onClick={() => setTurn((t) => (t + 1) % list.length)}>
              Próxima vez <ChevronRight size={14} />
            </button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => { set([]); setTurn(0) }}>
              <RotateCcw size={14} /> Limpar
            </button>
          </div>
        )}
      </div>
      {list.length > 0 && (
        <ol className="init-list">
          {list.map((c, i) => (
            <li key={c.id} className={i === turn % list.length ? 'init-row current' : 'init-row'} aria-current={i === turn % list.length ? 'step' : undefined}>
              <span className="init-value tabular">{c.value}</span>
              <span className="init-name">{c.name}</span>
              <input className="input input-sm init-hp" aria-label={`PV de ${c.name}`} placeholder="PV" value={c.hp} onChange={(e) => set(session.initiative.map((x) => (x.id === c.id ? { ...x, hp: e.target.value } : x)))} />
              <input className="input input-sm" aria-label={`Notas de ${c.name}`} placeholder="Condições…" value={c.note} onChange={(e) => set(session.initiative.map((x) => (x.id === c.id ? { ...x, note: e.target.value } : x)))} />
              <button type="button" className="btn-icon btn-xs" aria-label={`Remover ${c.name}`} onClick={() => set(session.initiative.filter((x) => x.id !== c.id))}>
                <X size={12} />
              </button>
            </li>
          ))}
        </ol>
      )}
      <form
        className="inline-fields"
        onSubmit={(e) => {
          e.preventDefault()
          add()
        }}
      >
        <label htmlFor="init-nome" className="sr-only">
          Nome
        </label>
        <input id="init-nome" className="input input-sm" placeholder="Combatente" value={name} onChange={(e) => setName(e.target.value)} />
        <label htmlFor="init-valor" className="sr-only">
          Iniciativa
        </label>
        <input id="init-valor" className="input input-sm input-year" inputMode="numeric" placeholder="d20" value={value} onChange={(e) => setValue(e.target.value)} />
        <button type="submit" className="btn btn-sm btn-ghost">
          <Plus size={14} /> Adicionar
        </button>
      </form>
      <p className="muted tiny">Sem valor, o Papirus rola 1d20.</p>
    </section>
  )
}
