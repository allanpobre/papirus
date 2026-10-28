import { Dices } from 'lucide-react'
import { useMemo, useState } from 'react'
import { diceIn } from '../../logic/dice'
import { physicalRoll, type RollOutcome, type RollRules } from '../../rpg/rolls'
import { Modal } from '../../ui/Modal'

/**
 * Dado físico: a pessoa rola na mesa e conta o que saiu; o app faz a conta (modificadores,
 * crítico, sucesso) e registra. Com muitos dados, um campo só, com os números separados.
 */
export function PhysicalRollDialog({
  system,
  outcome,
  who,
  onDone,
  onDigital,
  onClose,
}: {
  system: RollRules
  outcome: RollOutcome
  who?: string
  onDone: (o: RollOutcome) => void
  onDigital: () => void
  onClose: () => void
}) {
  const sides = useMemo(() => diceIn(outcome.expression), [outcome.expression])
  const many = sides.length > 6
  const [values, setValues] = useState<string[]>(() => sides.map(() => ''))
  const [text, setText] = useState('')
  const faces = many ? text.split(/[\s,;]+/).filter(Boolean).map(Number) : values.map(Number)
  const filled = many ? faces.length === sides.length : values.every((v) => v.trim() !== '')
  const preview = useMemo(() => {
    if (!filled) return null
    try {
      return { ok: physicalRoll(system, outcome, faces) }
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filled, system, outcome, values, text])

  const label = `${who ? `${who} · ` : ''}${outcome.label}`
  return (
    <Modal title="Quanto saiu no dado?" size="sm" onClose={onClose} help="dado-fisico">
      <form
        className="physical-roll"
        onSubmit={(e) => {
          e.preventDefault()
          if (preview?.ok) onDone(preview.ok)
        }}
      >
        <p className="physical-roll-what">
          <strong>{label}</strong>
          <span className="muted tabular"> · {outcome.expression}</span>
        </p>
        {sides.length === 0 ? (
          <p className="muted small">Essa rolagem não tem dados.</p>
        ) : many ? (
          <label className="field">
            <span className="field-label">
              Os {sides.length} dados (d{[...new Set(sides)].join(', d')}), separados por espaço
            </span>
            <input className="input" inputMode="numeric" autoFocus value={text} onChange={(e) => setText(e.target.value)} />
          </label>
        ) : (
          <div className="physical-roll-dice">
            {sides.map((n, i) => (
              <label key={i} className="physical-die">
                <span className="physical-die-name">d{n}</span>
                <input
                  className="input"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={n}
                  autoFocus={i === 0}
                  aria-label={`Resultado do ${i + 1}º dado (d${n})`}
                  value={values[i]}
                  onChange={(e) => setValues((v) => v.map((x, j) => (j === i ? e.target.value : x)))}
                />
              </label>
            ))}
          </div>
        )}
        <p className={`physical-roll-result tone-${preview?.ok?.tone ?? 'neutro'}`} role="status">
          {preview?.ok ? (
            <>
              Total <strong className="tabular">{preview.ok.result.total}</strong>
              {preview.ok.verdict && <span> · {preview.ok.verdict}</span>}
            </>
          ) : preview?.error ? (
            <span className="physical-roll-error">{preview.error}</span>
          ) : (
            <span className="muted">Digite o que saiu e o Papirus faz a conta.</span>
          )}
        </p>
        <div className="inline-fields">
          <button type="submit" className="btn btn-primary" disabled={!preview?.ok}>
            Registrar
          </button>
          <button type="button" className="btn btn-ghost" onClick={onDigital}>
            <Dices size={15} /> Rolar no app
          </button>
        </div>
      </form>
    </Modal>
  )
}
