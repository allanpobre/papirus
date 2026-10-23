import { Copy, Dices, Plus, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { DiceError } from '../../logic/dice'
import { MODIFIER_RULES, RESOLUTION_MODES, type GameSystem } from '../../model/schema'
import { insert, newId, patch, removeSystem } from '../../model/universe'
import { expandFormula, resolveRoll, type RollOutcome } from '../../rpg/rolls'
import { draftSheet } from '../../rpg/sheets'
import { SYSTEM_TEMPLATES, systemFromTemplate } from '../../rpg/systems'
import { useWorkspace } from '../../state/workspace'
import { Empty, Field, Select, TagInput, YearInput } from '../../ui/bits'
import { ConfirmButton } from '../../ui/ConfirmButton'

const MODIFIER_LABEL: Record<GameSystem['modifierRule'], string> = {
  nenhum: 'Sem modificador (o valor é usado como está)',
  direto: 'O próprio valor é o modificador',
  d20: '(valor − 10) ÷ 2, como nos sistemas d20',
}

const RESOLUTION_LABEL: Record<GameSystem['resolution'], string> = {
  total: 'Soma o total (compara com uma dificuldade)',
  sucessos: 'Conta sucessos (cada dado acima de um alvo)',
  abaixo: 'Rola d100 e passa se tirar igual ou menos',
}

/** Sistemas de jogo: modelos prontos e editáveis, ou do zero. */
export function SystemsTab() {
  const { universe, update } = useWorkspace()
  const [openId, setOpenId] = useState<string | null>(universe.systems[0]?.id ?? null)
  const [creating, setCreating] = useState(universe.systems.length === 0)
  const system = universe.systems.find((s) => s.id === openId)

  const create = (templateId: string) => {
    let id = ''
    update((u) => {
      const [next, s] = insert(u, 'systems', systemFromTemplate(templateId))
      id = s.id
      return next
    })
    setOpenId(id)
    setCreating(false)
  }

  return (
    <div className={`split${system || creating ? ' has-detail' : ''}`}>
      <section className="split-list" aria-label="Sistemas">
        <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
          <Plus size={16} /> Novo sistema
        </button>
        <ul className="entity-list">
          {universe.systems.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className="entity-row"
                aria-current={s.id === openId && !creating ? 'true' : undefined}
                onClick={() => {
                  setOpenId(s.id)
                  setCreating(false)
                }}
              >
                <Dices size={14} aria-hidden="true" />
                <span className="entity-row-name">{s.name || 'Sem nome'}</span>
                <span className="entity-row-kind">{universe.groups.filter((g) => g.systemId === s.id).length || ''}</span>
                <span className="entity-row-summary">
                  {s.attributes.length} atributos · {s.skills.length} perícias
                </span>
              </button>
            </li>
          ))}
        </ul>
        <p className="muted tiny">Modelos trazem só a estrutura (atributos, fórmulas, condições). Ajuste tudo à sua mesa.</p>
      </section>

      <section className="split-detail" aria-label="Sistema">
        {creating ? (
          <div className="template-picker">
            <h2 className="section-title">Começar de um modelo</h2>
            <div className="template-grid">
              {SYSTEM_TEMPLATES.map((t) => (
                <button key={t.id} type="button" className="template-card" onClick={() => create(t.id)}>
                  <span className="template-name">{t.name}</span>
                  <span className="template-desc">{t.description}</span>
                </button>
              ))}
            </div>
            <p className="muted small">Para um sistema próprio, comece pelo “Sem sistema” e adicione atributos, recursos e perícias.</p>
          </div>
        ) : system ? (
          <SystemEditor key={system.id} system={system} onDeleted={() => setOpenId(null)} onDuplicated={setOpenId} />
        ) : (
          <Empty icon={<Dices size={32} />} title="Escolha ou crie um sistema." />
        )}
      </section>
    </div>
  )
}

function SystemEditor({ system: s, onDeleted, onDuplicated }: { system: GameSystem; onDeleted: () => void; onDuplicated: (id: string) => void }) {
  const { universe, update, undoable } = useWorkspace()
  const [test, setTest] = useState<{ label: string; outcome?: RollOutcome; error?: string } | null>(null)
  const set = (c: Partial<GameSystem>) => update((u) => patch(u, 'systems', s.id, c))
  const usedBy = universe.groups.filter((g) => g.systemId === s.id)
  const sample = { ...draftSheet('Teste', s), id: 'teste', createdAt: '', updatedAt: '' }

  const tryFormula = (label: string, formula: string, attributeId?: string | null) => {
    try {
      const expr = expandFormula(formula, { system: s, sheet: sample, attributeId, skillValue: s.resolution === 'abaixo' ? 50 : 0 })
      setTest({ label, outcome: resolveRoll(s, label, expr, s.resolution === 'abaixo' ? 50 : undefined) })
    } catch (err) {
      setTest({ label, error: err instanceof DiceError ? err.message : 'Fórmula inválida.' })
    }
  }

  return (
    <article className="entity system-editor">
      <header className="entity-head">
        <div className="entity-title-wrap">
          <label htmlFor="system-name" className="sr-only">
            Nome do sistema
          </label>
          <input id="system-name" className="entity-name" value={s.name} placeholder="Sem nome" onChange={(e) => set({ name: e.target.value })} />
          <span className="muted small">
            {usedBy.length ? `Usado por: ${usedBy.map((g) => g.name).join(', ')}` : 'Nenhuma mesa usa este sistema ainda (escolha no Painel do mestre).'}
          </span>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => {
            let id = ''
            update((u) => {
              const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = s
              void _id
              void _c
              void _u
              const [next, copy] = insert(u, 'systems', { ...structuredClone(rest), name: `${s.name} (cópia)` })
              id = copy.id
              return next
            })
            onDuplicated(id)
          }}
        >
          <Copy size={14} /> Duplicar
        </button>
        <ConfirmButton
          className="btn-icon"
          title="Apagar sistema"
          question="Apagar? Mesas e fichas ficam sem sistema."
          confirmLabel="Apagar sistema"
          onConfirm={() => {
            undoable('Sistema apagado', (u) => removeSystem(u, s.id))
            onDeleted()
          }}
        >
          <Trash2 size={16} aria-label="Apagar sistema" />
        </ConfirmButton>
      </header>

      <section className="entity-section">
        <h2 className="section-title">Regras</h2>
        <div className="form-grid">
          <Field label="Modificador dos atributos">
            {(id) => <Select id={id} value={s.modifierRule} onChange={(v) => set({ modifierRule: v })} options={MODIFIER_RULES.map((m) => ({ value: m, label: MODIFIER_LABEL[m] }))} />}
          </Field>
          <Field label="Como ler uma rolagem">
            {(id) => <Select id={id} value={s.resolution} onChange={(v) => set({ resolution: v })} options={RESOLUTION_MODES.map((m) => ({ value: m, label: RESOLUTION_LABEL[m] }))} />}
          </Field>
          {s.resolution === 'sucessos' && (
            <Field label="Sucesso a partir de">
              {(id) => <YearInput id={id} label="Sucesso a partir de" value={s.successTarget} onChange={(v) => v !== null && set({ successTarget: v })} />}
            </Field>
          )}
          <label className="check field-wide">
            <input type="checkbox" checked={s.zeroDiceRule} onChange={(e) => set({ zeroDiceRule: e.target.checked })} />
            Sem dados para rolar (0 ou menos): rola 2 e fica com o pior
          </label>
        </div>
      </section>

      <section className="entity-section">
        <h2 className="section-title">Fórmulas</h2>
        <p className="muted small">
          Marcadores: <code>{'{atr}'}</code> atributo da rolagem, <code>{'{mod}'}</code> seu modificador, <code>{'{per}'}</code> perícia,{' '}
          <code>{'{DES}'}</code> ou <code>{'{mod:DES}'}</code> um atributo pela sigla, <code>{'{per:Iniciativa}'}</code> uma perícia pelo nome. Dados: <code>2d6+3</code>,{' '}
          <code>3d20kh1</code> (fica o maior), <code>2d20kl1</code> (fica o menor), <code>d100</code>.
        </p>
        <div className="formula-rows">
          {(
            [
              ['skillFormula', 'Perícia', s.skills[0]?.attributeId ?? s.attributes[0]?.id],
              ['attributeFormula', 'Atributo', s.attributes[0]?.id],
              ['initiativeFormula', 'Iniciativa', null],
            ] as const
          ).map(([key, label, attrId]) => (
            <div key={key} className="formula-row">
              <label htmlFor={`f-${key}`} className="field-label">
                {label}
              </label>
              <input id={`f-${key}`} className="input input-mono" value={s[key]} onChange={(e) => set({ [key]: e.target.value })} spellCheck={false} />
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => tryFormula(label, s[key], attrId)}>
                Testar
              </button>
            </div>
          ))}
        </div>
        {test && (
          <p className={`formula-test${test.error ? ' notice notice-error' : ''}`} role="status">
            {test.error ??
              `${test.label}: ${test.outcome!.result.total}${test.outcome!.verdict ? ` (${test.outcome!.verdict})` : ''} · ${test.outcome!.expression} com a ficha padrão`}
          </p>
        )}
      </section>

      <section className="entity-section">
        <h2 className="section-title">Atributos</h2>
        <div className="table-wrap">
          <table className="table table-compact">
            <thead>
              <tr>
                <th>Sigla</th>
                <th>Nome</th>
                <th>Padrão</th>
                <th>Mín.</th>
                <th>Máx.</th>
                <th>
                  <span className="sr-only">Remover</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {s.attributes.map((a, i) => {
                const setA = (c: Partial<typeof a>) => set({ attributes: s.attributes.map((x, j) => (j === i ? { ...x, ...c } : x)) })
                return (
                  <tr key={a.id}>
                    <td>
                      <input className="input input-sm input-abbr" aria-label="Sigla" value={a.abbr} onChange={(e) => setA({ abbr: e.target.value.toUpperCase().slice(0, 6) })} />
                    </td>
                    <td>
                      <input className="input input-sm" aria-label="Nome do atributo" value={a.name} onChange={(e) => setA({ name: e.target.value })} />
                    </td>
                    <td>
                      <YearInput label="Padrão" value={a.default} onChange={(v) => v !== null && setA({ default: v })} />
                    </td>
                    <td>
                      <YearInput label="Mínimo" value={a.min} onChange={(v) => v !== null && setA({ min: v })} />
                    </td>
                    <td>
                      <YearInput label="Máximo" value={a.max} onChange={(v) => v !== null && setA({ max: v })} />
                    </td>
                    <td>
                      <button type="button" className="btn-icon btn-sm" aria-label={`Remover ${a.name}`} onClick={() => set({ attributes: s.attributes.filter((x) => x.id !== a.id), skills: s.skills.map((k) => (k.attributeId === a.id ? { ...k, attributeId: null } : k)) })}>
                        <X size={14} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => set({ attributes: [...s.attributes, { id: newId(), abbr: 'NOV', name: 'Novo atributo', default: s.attributes[0]?.default ?? 0, min: s.attributes[0]?.min ?? 0, max: s.attributes[0]?.max ?? 10 }] })}
        >
          <Plus size={14} /> Atributo
        </button>
      </section>

      <section className="entity-section">
        <h2 className="section-title">Recursos</h2>
        <p className="muted small">Valores com atual e máximo: vida, mana, sanidade, defesa… O primeiro aparece na iniciativa.</p>
        <ul className="plain-list">
          {s.resources.map((r, i) => {
            const setR = (c: Partial<typeof r>) => set({ resources: s.resources.map((x, j) => (j === i ? { ...x, ...c } : x)) })
            return (
              <li key={r.id} className="kv-row kv-row-3">
                <input className="input input-sm input-abbr" aria-label="Sigla do recurso" value={r.abbr} onChange={(e) => setR({ abbr: e.target.value.toUpperCase().slice(0, 6) })} />
                <input className="input input-sm" aria-label="Nome do recurso" value={r.name} onChange={(e) => setR({ name: e.target.value })} />
                <YearInput label="Valor inicial" value={r.default} onChange={(v) => v !== null && setR({ default: v })} />
                <button type="button" className="btn-icon btn-sm" aria-label={`Remover ${r.name}`} onClick={() => set({ resources: s.resources.filter((x) => x.id !== r.id) })}>
                  <X size={14} />
                </button>
              </li>
            )
          })}
        </ul>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => set({ resources: [...s.resources, { id: newId(), abbr: 'REC', name: 'Novo recurso', default: 10 }] })}>
          <Plus size={14} /> Recurso
        </button>
      </section>

      <section className="entity-section">
        <h2 className="section-title">Perícias ({s.skills.length})</h2>
        <ul className="skill-edit-list">
          {s.skills.map((k, i) => (
            <li key={k.id} className="skill-edit">
              <input className="input input-sm" aria-label="Nome da perícia" value={k.name} onChange={(e) => set({ skills: s.skills.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
              <Select
                label={`Atributo de ${k.name}`}
                value={k.attributeId ?? ''}
                onChange={(v) => set({ skills: s.skills.map((x, j) => (j === i ? { ...x, attributeId: v || null } : x)) })}
                options={[{ value: '', label: '—' }, ...s.attributes.map((a) => ({ value: a.id, label: a.abbr }))]}
              />
              <button type="button" className="btn-icon btn-sm" aria-label={`Remover ${k.name}`} onClick={() => set({ skills: s.skills.filter((x) => x.id !== k.id) })}>
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => set({ skills: [...s.skills, { id: newId(), name: 'Nova perícia', attributeId: s.attributes[0]?.id ?? null }] })}>
          <Plus size={14} /> Perícia
        </button>
      </section>

      <section className="entity-section">
        <div className="form-grid">
          <div className="field-wide">
            <TagInput label="Condições" value={s.conditions} onChange={(v) => set({ conditions: v })} placeholder="Nova condição…" />
          </div>
          <div className="field-wide">
            <TagInput label="Campos de texto da ficha" value={s.fields} onChange={(v) => set({ fields: v })} placeholder="Classe, origem…" />
          </div>
        </div>
      </section>

      <section className="entity-section">
        <h2 className="section-title">O que a mesa usa</h2>
        {(
          [
            ['initiative', 'Iniciativa nas sessões'],
            ['resources', 'Recursos (vida, mana…) nas fichas'],
            ['conditions', 'Condições'],
            ['rollLog', 'Registrar rolagens na sessão em andamento'],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="toggle">
            <input type="checkbox" role="switch" checked={s.features[key]} onChange={(e) => set({ features: { ...s.features, [key]: e.target.checked } })} />
            <span className="toggle-track" aria-hidden="true" />
            <span>{label}</span>
          </label>
        ))}
      </section>
    </article>
  )
}
