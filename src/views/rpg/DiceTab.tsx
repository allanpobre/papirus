import { useState } from 'react'
import { DiceError, roll, type DiceRoll } from '../../logic/dice'

const QUICK = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100']

/** Rolador de dados com histórico desta visita. */
export function DiceTab() {
  const [expr, setExpr] = useState('1d20')
  const [history, setHistory] = useState<DiceRoll[]>([])
  const [error, setError] = useState<string | null>(null)

  const run = (e: string) => {
    try {
      const r = roll(e)
      setHistory((h) => [r, ...h].slice(0, 30))
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
      </section>
      <section className="dice-history">
        <h2 className="section-title">Histórico</h2>
        <ol className="plain-list small">
          {history.slice(1).map((r, i) => (
            <li key={i}>
              <span className="tabular">{r.total}</span> <span className="muted">{r.expression}</span>
            </li>
          ))}
        </ol>
      </section>
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
