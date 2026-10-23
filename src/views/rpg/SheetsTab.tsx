import { ArrowLeft, Dices, Heart, Minus, Plus, Swords, Trash2, UserRound } from 'lucide-react'
import { useMemo, useState } from 'react'
import { fold } from '../../logic/text'
import type { GameSystem, Sheet } from '../../model/schema'
import { byId, insert, newId, patch, removeSheet } from '../../model/universe'
import { modifier, rollAttribute, rollInitiative, rollSkill } from '../../rpg/rolls'
import { adjustResource, attributeOf, draftSheet } from '../../rpg/sheets'
import { useWorkspace } from '../../state/workspace'
import { Empty, Field, Select, YearInput } from '../../ui/bits'
import { ConfirmButton } from '../../ui/ConfirmButton'
import { EntityPicker } from '../../ui/EntityPicker'
import { useRpg } from './rpgContext'

const signed = (n: number) => (n >= 0 ? `+${n}` : String(n))

/** Fichas de jogo da mesa: personagens dos jogadores e NPCs. */
export function SheetsTab() {
  const { universe, update } = useWorkspace()
  const { group, system } = useRpg()
  const [role, setRole] = useState<'todos' | Sheet['role']>('todos')
  const [name, setName] = useState('')
  const [newRole, setNewRole] = useState<Sheet['role']>('pj')
  const sheets = universe.sheets
    .filter((s) => s.groupId === group.id && (role === 'todos' || s.role === role))
    .sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name, 'pt') : a.role === 'pj' ? -1 : 1))
  const [openId, setOpenId] = useState<string | null>(sheets[0]?.id ?? null)
  const open = openId ? byId(universe, 'sheets', openId) : undefined

  return (
    <div className={`split${open ? ' has-detail' : ''}`}>
      <section className="split-list" aria-label="Personagens da mesa">
        <form
          className="quick-create"
          onSubmit={(e) => {
            e.preventDefault()
            if (!name.trim()) return
            let id = ''
            update((u) => {
              const [next, s] = insert(u, 'sheets', draftSheet(name.trim(), system ?? null, { role: newRole, groupId: group.id }))
              id = s.id
              return next
            })
            setName('')
            setOpenId(id)
          }}
        >
          <label htmlFor="nova-ficha-jogo" className="sr-only">
            Nome do personagem
          </label>
          <input id="nova-ficha-jogo" className="input" placeholder="Novo personagem…" value={name} onChange={(e) => setName(e.target.value)} />
          <Select
            label="Tipo"
            value={newRole}
            onChange={setNewRole}
            options={[
              { value: 'pj', label: 'Jogador' },
              { value: 'npc', label: 'NPC' },
            ]}
          />
          <button type="submit" className="btn btn-primary" aria-label="Criar personagem">
            <Plus size={16} />
          </button>
        </form>
        <div className="filter-chips" role="radiogroup" aria-label="Mostrar">
          {(
            [
              ['todos', 'Todos'],
              ['pj', 'Jogadores'],
              ['npc', 'NPCs'],
            ] as const
          ).map(([r, label]) => (
            <button key={r} type="button" role="radio" aria-checked={role === r} className="chip" onClick={() => setRole(r)}>
              {label}
            </button>
          ))}
        </div>
        {!system && <p className="notice small">Esta mesa ainda não tem sistema. Escolha um no Painel do mestre para ter atributos e perícias.</p>}
        {sheets.length === 0 ? (
          <p className="muted small">Nenhum personagem nesta mesa.</p>
        ) : (
          <ul className="entity-list">
            {sheets.map((s) => {
              const sys = universe.systems.find((x) => x.id === s.systemId)
              const main = sys?.resources[0]
              const r = main ? (s.resources[main.id] ?? { current: main.default, max: main.default }) : null
              return (
                <li key={s.id}>
                  <button type="button" className="entity-row" aria-current={s.id === openId ? 'true' : undefined} onClick={() => setOpenId(s.id)}>
                    <span className={`role-dot role-${s.role}`} aria-hidden="true" />
                    <span className="entity-row-name">{s.name || 'Sem nome'}</span>
                    <span className="entity-row-kind">{s.role === 'pj' ? s.player || 'Jogador' : 'NPC'}</span>
                    <span className="entity-row-summary">
                      {r && main ? `${main.abbr} ${r.current}/${r.max}` : ''}
                      {s.conditions.length ? ` · ${s.conditions.join(', ')}` : ''}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>
      <section className="split-detail" aria-label="Ficha de jogo">
        {open ? <SheetEditor key={open.id} sheet={open} onBack={() => setOpenId(null)} /> : <Empty icon={<UserRound size={32} />} title="Escolha ou crie um personagem." />}
      </section>
    </div>
  )
}

function SheetEditor({ sheet: s, onBack }: { sheet: Sheet; onBack: () => void }) {
  const { universe, update, undoable, go, toast } = useWorkspace()
  const { report, activeSession } = useRpg()
  const [skillFilter, setSkillFilter] = useState('')
  const system = universe.systems.find((x) => x.id === s.systemId)
  const set = (c: Partial<Sheet>) => update((u) => patch(u, 'sheets', s.id, c))

  const addToInitiative = () => {
    if (!activeSession || !system) return
    const value = rollInitiative(system, s)
    update((u) => patch(u, 'sessions', activeSession.id, { initiative: [...activeSession.initiative, { id: newId(), name: s.name, value, hp: '', note: '', sheetId: s.id }] }))
    toast(`${s.name} entrou na iniciativa com ${value}`)
  }

  return (
    <article className="entity sheet">
      <header className="entity-head">
        <button type="button" className="btn-icon back-btn" aria-label="Voltar para a lista" onClick={onBack}>
          <ArrowLeft size={18} />
        </button>
        <div className="entity-title-wrap">
          <label htmlFor="sheet-name" className="sr-only">
            Nome do personagem
          </label>
          <input id="sheet-name" className="entity-name" value={s.name} placeholder="Sem nome" onChange={(e) => set({ name: e.target.value })} />
          <div className="entity-badges">
            <span className="eyebrow">{s.role === 'pj' ? 'Personagem de jogador' : 'NPC'}</span>
            {system && <span className="muted small">{system.name}</span>}
          </div>
        </div>
        {activeSession && system?.features.initiative && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={addToInitiative}>
            <Swords size={14} /> Rolar iniciativa
          </button>
        )}
        <ConfirmButton className="btn-icon" title="Apagar ficha de jogo" question="Apagar esta ficha de jogo?" confirmLabel="Apagar" onConfirm={() => { undoable('Ficha de jogo apagada', (u) => removeSheet(u, s.id)); onBack() }}>
          <Trash2 size={16} aria-label="Apagar ficha de jogo" />
        </ConfirmButton>
      </header>

      <div className="form-grid">
        <Field label="Tipo">
          {(id) => (
            <Select
              id={id}
              value={s.role}
              onChange={(v) => set({ role: v })}
              options={[
                { value: 'pj', label: 'Personagem de jogador' },
                { value: 'npc', label: 'NPC' },
              ]}
            />
          )}
        </Field>
        {s.role === 'pj' && (
          <Field label="Jogador">
            {(id) => <input id={id} className="input" value={s.player} placeholder="Quem joga" onChange={(e) => set({ player: e.target.value })} />}
          </Field>
        )}
        <EntityPicker label="Ficha no mundo" kinds={['personagem']} value={s.entityId} onChange={(v) => set({ entityId: v })} placeholder="Ligar a uma ficha…" />
        <Field label="Sistema">
          {(id) => (
            <Select
              id={id}
              value={s.systemId ?? ''}
              onChange={(v) => set({ systemId: v || null })}
              options={[{ value: '', label: 'Sem sistema' }, ...universe.systems.map((x) => ({ value: x.id, label: x.name }))]}
            />
          )}
        </Field>
        {s.entityId && (
          <button type="button" className="link-btn" onClick={() => go('fichas', s.entityId)}>
            Abrir a ficha do mundo
          </button>
        )}
      </div>

      {system ? (
        <>
          {system.attributes.length > 0 && (
            <section className="entity-section">
              <h2 className="section-title">Atributos</h2>
              <div className="attr-grid">
                {system.attributes.map((a) => {
                  const v = attributeOf(system, s, a.id)
                  return (
                    <div key={a.id} className="attr-card">
                      <span className="attr-abbr" title={a.name}>
                        {a.abbr}
                      </span>
                      <YearInput label={a.name} value={v} onChange={(n) => n !== null && set({ attributes: { ...s.attributes, [a.id]: Math.max(a.min, Math.min(a.max, n)) } })} />
                      {system.modifierRule === 'd20' && <span className="attr-mod">{signed(modifier(system, v))}</span>}
                      <button type="button" className="btn btn-ghost btn-xs attr-roll" aria-label={`Rolar ${a.name}`} onClick={() => report(rollAttribute(system, s, a.id), s.name)}>
                        <Dices size={13} />
                      </button>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {system.features.resources && system.resources.length > 0 && (
            <section className="entity-section">
              <h2 className="section-title">Recursos</h2>
              <div className="resource-list">
                {system.resources.map((r) => (
                  <ResourceRow key={r.id} system={system} sheet={s} resourceId={r.id} onChange={(resources) => set({ resources })} />
                ))}
              </div>
            </section>
          )}

          {system.features.conditions && system.conditions.length > 0 && (
            <section className="entity-section">
              <h2 className="section-title">Condições</h2>
              <div className="chips">
                {system.conditions.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className="chip chip-condition"
                    aria-pressed={s.conditions.includes(c)}
                    onClick={() => set({ conditions: s.conditions.includes(c) ? s.conditions.filter((x) => x !== c) : [...s.conditions, c] })}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </section>
          )}

          {system.skills.length > 0 && (
            <section className="entity-section">
              <div className="section-head">
                <h2 className="section-title">Perícias</h2>
                <input className="input input-sm skill-filter" aria-label="Filtrar perícias" placeholder="Filtrar…" value={skillFilter} onChange={(e) => setSkillFilter(e.target.value)} />
              </div>
              <ul className="skill-list">
                {system.skills
                  .filter((k) => !skillFilter || fold(k.name).includes(fold(skillFilter)))
                  .map((k) => {
                    const attr = system.attributes.find((a) => a.id === k.attributeId)
                    return (
                      <li key={k.id} className={`skill${(s.skills[k.id] ?? 0) !== 0 ? ' skill-trained' : ''}`}>
                        <button type="button" className="skill-roll" onClick={() => report(rollSkill(system, s, k.id), s.name)}>
                          <Dices size={13} aria-hidden="true" />
                          <span className="skill-name">{k.name}</span>
                          {attr && <span className="skill-attr">{attr.abbr}</span>}
                        </button>
                        <YearInput label={`Valor de ${k.name}`} value={s.skills[k.id] ?? 0} onChange={(n) => n !== null && set({ skills: { ...s.skills, [k.id]: n } })} />
                      </li>
                    )
                  })}
              </ul>
            </section>
          )}

          {system.fields.length > 0 && (
            <section className="entity-section">
              <div className="form-grid">
                {system.fields.map((f) => (
                  <Field key={f} label={f}>
                    {(id) => <input id={id} className="input" value={s.fields[f] ?? ''} onChange={(e) => set({ fields: { ...s.fields, [f]: e.target.value } })} />}
                  </Field>
                ))}
              </div>
            </section>
          )}
        </>
      ) : (
        <p className="notice small">Sem sistema, a ficha guarda só anotações. Escolha um sistema acima para ter atributos, recursos e rolagens.</p>
      )}

      <Field label="Anotações" wide>
        {(id) => <textarea id={id} className="input textarea" rows={4} value={s.notes} onChange={(e) => set({ notes: e.target.value })} />}
      </Field>
    </article>
  )
}

/** Recurso com atual e máximo, botões rápidos e um campo de dano/cura. */
export function ResourceRow({
  system,
  sheet,
  resourceId,
  onChange,
  compact = false,
}: {
  system: GameSystem
  sheet: Sheet
  resourceId: string
  onChange: (resources: Sheet['resources']) => void
  compact?: boolean
}) {
  const def = system.resources.find((r) => r.id === resourceId)
  const [amount, setAmount] = useState('')
  const r = useMemo(() => sheet.resources[resourceId] ?? { current: def?.default ?? 0, max: def?.default ?? 0 }, [sheet.resources, resourceId, def])
  if (!def) return null
  const pct = r.max > 0 ? Math.max(0, Math.min(100, (r.current / r.max) * 100)) : 0
  const apply = (sign: 1 | -1) => {
    const n = Math.abs(Number(amount))
    if (!Number.isFinite(n) || n === 0) return
    onChange(adjustResource({ ...sheet, resources: { ...sheet.resources, [resourceId]: r } }, resourceId, sign * n))
    setAmount('')
  }
  const setValue = (c: Partial<typeof r>) => onChange({ ...sheet.resources, [resourceId]: { ...r, ...c } })

  return (
    <div className={`resource${compact ? ' resource-compact' : ''}${r.max > 0 && r.current <= 0 ? ' resource-empty' : ''}`}>
      <span className="resource-name" title={def.name}>
        {def.abbr}
      </span>
      <span className="resource-bar" aria-hidden="true">
        <span style={{ width: `${pct}%` }} />
      </span>
      <span className="resource-values">
        <YearInput label={`${def.name} atual`} value={r.current} onChange={(v) => v !== null && setValue({ current: v })} />
        <span className="muted">/</span>
        <YearInput label={`${def.name} máximo`} value={r.max} onChange={(v) => v !== null && setValue({ max: v })} />
      </span>
      {!compact && (
        <span className="resource-adjust">
          <button type="button" className="btn-icon btn-sm" aria-label={`Menos 1 ${def.abbr}`} onClick={() => onChange(adjustResource({ ...sheet, resources: { ...sheet.resources, [resourceId]: r } }, resourceId, -1))}>
            <Minus size={14} />
          </button>
          <button type="button" className="btn-icon btn-sm" aria-label={`Mais 1 ${def.abbr}`} onClick={() => onChange(adjustResource({ ...sheet, resources: { ...sheet.resources, [resourceId]: r } }, resourceId, 1))}>
            <Plus size={14} />
          </button>
          <input className="input input-sm resource-amount" inputMode="numeric" aria-label={`Quantidade de ${def.abbr}`} placeholder="Qtd." value={amount} onChange={(e) => setAmount(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && apply(-1)} />
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => apply(-1)}>
            <Swords size={13} /> Dano
          </button>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => apply(1)}>
            <Heart size={13} /> Cura
          </button>
        </span>
      )}
    </div>
  )
}
