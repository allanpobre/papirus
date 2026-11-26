import { Dices, Lightbulb, RotateCcw, Sprout } from 'lucide-react'
import { useState } from 'react'
import { rollTable, WORLD_TABLES, type Rolled, type WorldTable } from '../logic/worldRolls'
import { draftInbox, draftSeed, insert } from '../model/universe'
import { useWorkspace } from '../state/workspace'
import { Modal } from '../ui/Modal'

/*
 * Rolar no mundo: escolher uma tabela (pronta ou do universo, as mesmas da Mesa), rolar e transformar o
 * resultado em pista (Trama) ou ideia (Ideias). Tudo sai do que já existe no mundo.
 */
export function RollDialog({ onClose }: { onClose: () => void }) {
  const { universe, update, toast } = useWorkspace()
  const own: WorldTable[] = universe.tables.filter((t) => t.entries.some((e) => e.trim())).map((t) => ({ id: t.id, name: t.name || 'Sem nome', entries: t.entries }))
  const [tableId, setTableId] = useState(WORLD_TABLES[0].id)
  const table = [...WORLD_TABLES, ...own].find((t) => t.id === tableId) ?? WORLD_TABLES[0]
  const [result, setResult] = useState<Rolled | null>(null)
  const [before, setBefore] = useState<{ table: string; text: string }[]>([])
  const [spin, setSpin] = useState(0)
  const roll = () => {
    if (result) setBefore((b) => [{ table: table.name, text: result.text }, ...b].slice(0, 3))
    setResult(rollTable(table, universe))
    setSpin((n) => n + 1)
  }
  const toSeed = () => {
    if (!result) return
    update((u) => insert(u, 'seeds', { ...draftSeed(result.text.length > 80 ? `${result.text.slice(0, 77)}…` : result.text), description: result.text, entityIds: result.entityIds })[0])
    toast('Virou pista em Trama › Pistas e mistérios.')
    setResult(null)
  }
  const toIdea = () => {
    if (!result) return
    update((u) => insert(u, 'inbox', draftInbox(result.text, 'captura', `Rolar no mundo · ${table.name}`))[0])
    toast('Guardado em Ideias.')
    setResult(null)
  }
  return (
    <Modal about="Sem ideia? Role um boato, um encontro, um segredo ou uma festa, tirados do seu mundo. O que gostar vira pista ou ideia." title="Rolar no mundo" onClose={onClose}>
      <p className="small muted">Sorteia a partir do que já existe em “{universe.name}”: lugares, povos, personagens, grupos e as línguas do mundo.</p>
      <div className="chips roll-tables" role="radiogroup" aria-label="Tabela">
        {WORLD_TABLES.map((t) => (
          <button key={t.id} type="button" role="radio" className="chip" aria-checked={t.id === table.id} onClick={() => setTableId(t.id)}>
            {t.name}
          </button>
        ))}
        {own.map((t) => (
          <button key={t.id} type="button" role="radio" className="chip" aria-checked={t.id === table.id} onClick={() => setTableId(t.id)}>
            {t.name} <span className="muted tiny">(sua)</span>
          </button>
        ))}
      </div>
      <button key={spin} type="button" className="roll-die" onClick={roll} aria-label={`Rolar: ${table.name}`}>
        <Dices size={40} aria-hidden="true" />
        <span>Rolar</span>
      </button>
      {result && (
        <section className="roll-result" aria-label="Resultado">
          <h3>{table.name}</h3>
          <p>{result.text}</p>
          <div className="row roll-actions">
            <button type="button" className="btn btn-primary btn-sm" onClick={toSeed}>
              <Sprout size={14} aria-hidden="true" /> Virar pista
            </button>
            <button type="button" className="btn btn-sm" onClick={toIdea}>
              <Lightbulb size={14} aria-hidden="true" /> Virar ideia
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={roll}>
              <RotateCcw size={14} aria-hidden="true" /> Rolar de novo
            </button>
          </div>
        </section>
      )}
      {before.length > 0 && (
        <ul className="roll-before small muted" aria-label="Rolagens de antes">
          {before.map((b, i) => (
            <li key={i}>
              <strong>{b.table}:</strong> {b.text}
            </li>
          ))}
        </ul>
      )}
      <p className="tiny muted">Para criar as suas tabelas: Mesa › Tabelas. Use {'{lugar}'}, {'{personagem}'}, {'{povo}'}, {'{grupo}'}, {'{objeto}'} e {'{nomeNovo}'} para sortear do mundo.</p>
    </Modal>
  )
}
