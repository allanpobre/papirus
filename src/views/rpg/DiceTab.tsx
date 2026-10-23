import { Dices, Plus, Trash2 } from 'lucide-react'
import { useContext, useState } from 'react'
import { DiceError, roll, type DiceRoll } from '../../logic/dice'
import type { RandomTable } from '../../model/schema'
import { insert, patch, remove } from '../../model/universe'
import { resolveRoll } from '../../rpg/rolls'
import { makeSystem } from '../../rpg/systems'
import { useWorkspace } from '../../state/workspace'
import { ConfirmButton } from '../../ui/ConfirmButton'
import { RpgContext } from './rpgContext'

const QUICK = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100']
const FALLBACK_SYSTEM = makeSystem('narrativo')

/** Rolador livre e tabelas aleatórias do mestre. */
export function DiceTab() {
  const rpg = useContext(RpgContext)
  const [expr, setExpr] = useState('1d20')
  const [history, setHistory] = useState<DiceRoll[]>([])
  const [error, setError] = useState<string | null>(null)

  const run = (e: string) => {
    try {
      if (rpg) {
        // Com uma mesa aberta, a rolagem vai para a bandeja e para o registro da sessão.
        const outcome = resolveRoll(rpg.system ?? FALLBACK_SYSTEM, 'Rolagem livre', e.replace(/\s+/g, '') || 'd20')
        rpg.report(outcome)
        setHistory((h) => [outcome.result, ...h].slice(0, 30))
      } else {
        setHistory((h) => [roll(e), ...h].slice(0, 30))
      }
      setError(null)
    } catch (err) {
      setError(err instanceof DiceError ? err.message : 'Rolagem inválida.')
    }
  }

  const last = history[0]

  return (
    <div className="dice">
      <section className="dice-main">
        <form
          className="dice-form"
          onSubmit={(e) => {
            e.preventDefault()
            run(expr)
          }}
        >
          <label htmlFor="dice-expr" className="field-label">
            Rolagem
          </label>
          <div className="inline-fields">
            <input id="dice-expr" className="input input-lg dice-input" value={expr} onChange={(e) => setExpr(e.target.value)} spellCheck={false} />
            <button type="submit" className="btn btn-primary btn-lg">
              Rolar
            </button>
          </div>
          {error && (
            <p className="notice notice-error" role="alert">
              {error}
            </p>
          )}
          <p className="muted tiny">Exemplos: 2d6+3, 4d6kh3 (mantém os 3 maiores), 2d20kh1 (vantagem), 2d20kl1 (desvantagem), d%.</p>
        </form>
        <div className="dice-quick" aria-label="Dados rápidos">
          {QUICK.map((d) => (
            <button key={d} type="button" className="die" onClick={() => run(d)}>
              {d}
            </button>
          ))}
          <button type="button" className="die die-wide" onClick={() => run('2d20kh1')}>
            Vantagem
          </button>
          <button type="button" className="die die-wide" onClick={() => run('2d20kl1')}>
            Desvantagem
          </button>
        </div>
        <div className="dice-result" aria-live="polite">
          {last ? (
            <>
              <span className="dice-total tabular">{last.total}</span>
              <span className="dice-expr">{last.expression}</span>
              <span className="dice-parts">
                {last.parts.map((p, i) => (
                  <span key={i}>
                    {p.label}
                    {p.rolls.length > 0 && (
                      <>
                        {' '}
                        [
                        {p.rolls.map((r, j) => (
                          <span key={j} className={p.kept.length !== p.rolls.length && !keptIndex(p, j) ? 'die-dropped' : undefined}>
                            {j > 0 && ', '}
                            {r}
                          </span>
                        ))}
                        ]
                      </>
                    )}{' '}
                  </span>
                ))}
              </span>
            </>
          ) : (
            <span className="muted">Role algo.</span>
          )}
        </div>
        {rpg && <p className="muted tiny">{rpg.activeSession ? `Rolagens vão para o registro de “${rpg.activeSession.title}”.` : 'Comece uma sessão para registrar as rolagens.'}</p>}
      </section>
      <section className="dice-side">
        <RandomTables />
        <div className="dice-history">
          <h2 className="section-title">Histórico</h2>
          <ol className="plain-list small">
            {history.slice(1).map((r, i) => (
              <li key={i}>
                <span className="tabular">{r.total}</span> <span className="muted">{r.expression}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </div>
  )
}

/** Tabelas aleatórias próprias: uma entrada por linha, rola com um clique. */
function RandomTables() {
  const { universe, update } = useWorkspace()
  const rpg = useContext(RpgContext)
  const [name, setName] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [results, setResults] = useState<Record<string, string>>({})

  const rollTable = (t: RandomTable) => {
    const entries = t.entries.filter((e) => e.trim())
    if (!entries.length) return
    const r = roll(`1d${Math.max(2, entries.length)}`)
    const pick = entries[Math.min(entries.length, r.total) - 1]
    setResults((x) => ({ ...x, [t.id]: pick }))
    rpg?.logText(`${t.name}: ${pick}`, 'rolagem')
  }

  return (
    <div className="tables">
      <h2 className="section-title">Tabelas aleatórias</h2>
      <form
        className="inline-fields"
        onSubmit={(e) => {
          e.preventDefault()
          if (!name.trim()) return
          let id = ''
          update((u) => {
            const [next, t] = insert(u, 'tables', { name: name.trim(), entries: [] })
            id = t.id
            return next
          })
          setName('')
          setEditing(id)
        }}
      >
        <label htmlFor="nova-tabela" className="sr-only">
          Nome da tabela
        </label>
        <input id="nova-tabela" className="input input-sm" placeholder="Nomes de taverna, rumores…" value={name} onChange={(e) => setName(e.target.value)} />
        <button type="submit" className="btn btn-sm btn-ghost">
          <Plus size={14} /> Tabela
        </button>
      </form>
      {universe.tables.length === 0 && <p className="muted small">Nenhuma tabela. Crie uma e escreva uma opção por linha.</p>}
      <ul className="table-cards">
        {universe.tables.map((t) => (
          <li key={t.id} className="table-card">
            <div className="table-card-head">
              <input className="input input-sm table-name" aria-label="Nome da tabela" value={t.name} onChange={(e) => update((u) => patch(u, 'tables', t.id, { name: e.target.value }))} />
              <span className="muted tiny">{t.entries.filter((e) => e.trim()).length} opções</span>
              <button type="button" className="btn btn-sm btn-primary" disabled={!t.entries.some((e) => e.trim())} onClick={() => rollTable(t)}>
                <Dices size={14} /> Rolar
              </button>
              <button type="button" className="btn btn-sm btn-ghost" aria-expanded={editing === t.id} onClick={() => setEditing(editing === t.id ? null : t.id)}>
                {editing === t.id ? 'Pronto' : 'Editar'}
              </button>
              <ConfirmButton className="btn-icon btn-sm" title="Apagar tabela" question="Apagar?" confirmLabel="Apagar" onConfirm={() => update((u) => remove(u, 'tables', t.id))}>
                <Trash2 size={14} aria-label="Apagar tabela" />
              </ConfirmButton>
            </div>
            {results[t.id] && (
              <p className="table-result" aria-live="polite">
                {results[t.id]}
              </p>
            )}
            {editing === t.id && (
              <textarea
                className="input textarea"
                aria-label={`Opções de ${t.name}, uma por linha`}
                rows={6}
                placeholder={'O Javali Bêbado\nA Lanterna Torta\nO Último Gole'}
                value={t.entries.join('\n')}
                onChange={(e) => update((u) => patch(u, 'tables', t.id, { entries: e.target.value.split('\n') }))}
              />
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Marca como mantido cada dado que entra no "kept" (respeitando repetidos). */
function keptIndex(p: DiceRoll['parts'][number], index: number): boolean {
  const remaining = [...p.kept]
  for (let i = 0; i < p.rolls.length; i++) {
    const at = remaining.indexOf(p.rolls[i])
    if (at >= 0) {
      remaining.splice(at, 1)
      if (i === index) return true
    } else if (i === index) return false
  }
  return false
}
