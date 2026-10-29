import { ArrowLeft, Dices, Heart, Minus, PenLine, Plus, Swords, Trash2, UserRound, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { fold } from '../../logic/text'
import type { GameSystem, Sheet } from '../../model/schema'
import { byId, insert, patch, removeSheet } from '../../model/universe'
import { modifier } from '../../rpg/rolls'
import { adjustResource, attributeOf, draftSheet, isPool } from '../../rpg/sheets'
import { recall, remember } from '../../state/prefs'
import { Picture } from '../../images/Picture'
import { SheetPlay } from './SheetPlay'
import { useWorkspace } from '../../state/workspace'
import { Empty, Field, Select, YearInput } from '../../ui/bits'
import { Fold } from '../../ui/Fold'
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
  const [player, setPlayer] = useState('')
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
              const [next, s] = insert(u, 'sheets', draftSheet(name.trim(), system ?? null, { role: newRole, groupId: group.id, player: newRole === 'pj' ? player.trim() : '' }))
              id = s.id
              return next
            })
            setName('')
            setPlayer('')
            setOpenId(id)
          }}
        >
          <label htmlFor="nova-ficha-jogo" className="sr-only">
            Nome do personagem
          </label>
          <input id="nova-ficha-jogo" className="input" placeholder="Novo personagem…" value={name} onChange={(e) => setName(e.target.value)} />
          <div className="segmented quick-role" role="radiogroup" aria-label="De quem é">
            {(
              [
                ['pj', 'De jogador'],
                ['npc', 'NPC do mestre'],
              ] as const
            ).map(([r, label]) => (
              <button key={r} type="button" role="radio" aria-checked={newRole === r} onClick={() => setNewRole(r)}>
                {label}
              </button>
            ))}
          </div>
          {newRole === 'pj' && (
            <>
              <label htmlFor="nova-ficha-jogador" className="sr-only">
                Quem joga
              </label>
              <input id="nova-ficha-jogador" className="input" placeholder="Quem joga (ex.: Ana)" value={player} onChange={(e) => setPlayer(e.target.value)} />
            </>
          )}
          <button type="submit" className="btn btn-primary" aria-label="Criar personagem">
            <Plus size={16} /> Criar
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
              const main = sys?.resources.find(isPool)
              const r = main ? (s.resources[main.id] ?? { current: main.default, max: main.default }) : null
              const portrait = s.image ?? (s.entityId ? byId(universe, 'entities', s.entityId)?.image : null)
              return (
                <li key={s.id}>
                  <button type="button" className="entity-row" aria-current={s.id === openId ? 'true' : undefined} onClick={() => setOpenId(s.id)}>
                    {portrait ? <Picture value={portrait} className="entity-row-pic" /> : <span className={`role-dot role-${s.role}`} aria-hidden="true" />}
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
  const { universe, update, undoable, go } = useWorkspace()
  const [skillFilter, setSkillFilter] = useState('')
  const system = universe.systems.find((x) => x.id === s.systemId)
  // Jogar (o padrão) ou Editar a estrutura da ficha; sem sistema, só há o que editar.
  const [mode, setMode] = useState<'jogar' | 'editar'>(() => (recall('ficha-jogo-modo') === 'editar' ? 'editar' : 'jogar'))
  const playing = mode === 'jogar' && Boolean(system)
  const choose = (m: 'jogar' | 'editar') => {
    setMode(m)
    remember('ficha-jogo-modo', m)
  }
  const set = (c: Partial<Sheet>) => update((u) => patch(u, 'sheets', s.id, c))

  return (
    <article className={`entity sheet${playing ? ' sheet-playing' : ''}`}>
      <header className="sheet-top">
        <button type="button" className="btn-icon back-btn" aria-label="Voltar para a lista" onClick={onBack}>
          <ArrowLeft size={18} />
        </button>
        {system && (
          <div className="mode-switch" role="group" aria-label="Modo da ficha de jogo">
            <button type="button" aria-pressed={playing} onClick={() => choose('jogar')}>
              <Dices size={15} aria-hidden="true" /> Jogar
            </button>
            <button type="button" aria-pressed={!playing} onClick={() => choose('editar')}>
              <PenLine size={15} aria-hidden="true" /> Editar
            </button>
          </div>
        )}
        <span className="sheet-top-space" />
        {!playing && (
          <ConfirmButton className="btn-icon" title="Apagar ficha de jogo" question="Apagar esta ficha de jogo?" confirmLabel="Apagar" onConfirm={() => { undoable('Ficha de jogo apagada', (u) => removeSheet(u, s.id)); onBack() }}>
            <Trash2 size={16} aria-label="Apagar ficha de jogo" />
          </ConfirmButton>
        )}
      </header>

      {playing && system ? (
        <SheetPlay sheet={s} system={system} />
      ) : (
        <>
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

          {system && system.fields.length > 0 && (
            <div className="form-grid">
              {system.fields.map((f) => (
                <Field key={f} label={f}>
                  {(id) => <input id={id} className="input" value={s.fields[f] ?? ''} onChange={(e) => set({ fields: { ...s.fields, [f]: e.target.value } })} />}
                </Field>
              ))}
            </div>
          )}

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
                <Fold id="jogo-atributos" title="Atributos">
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
                        </div>
                      )
                    })}
                  </div>
                </Fold>
              )}

              {system.features.resources && system.resources.length > 0 && (
                <Fold id="jogo-recursos" title="Recursos">
                  <div className="resource-list">
                    {system.resources.map((r) =>
                      isPool(r) ? (
                        <ResourceRow key={r.id} system={system} sheet={s} resourceId={r.id} onChange={(resources) => set({ resources })} />
                      ) : (
                        <div key={r.id} className="resource resource-value">
                          <span className="resource-name" title={r.name}>
                            {r.abbr}
                          </span>
                          <span className="muted small">{r.name}</span>
                          <YearInput
                            label={r.name}
                            value={(s.resources[r.id] ?? { current: r.default }).current}
                            onChange={(v) => v !== null && set({ resources: { ...s.resources, [r.id]: { current: v, max: v } } })}
                          />
                        </div>
                      ),
                    )}
                  </div>
                </Fold>
              )}

              {system.skills.length > 0 && (
                <section className="entity-section">
                  <div className="section-head">
                    <h2 className="section-title">Perícias</h2>
                    <input className="input input-sm skill-filter" data-livre aria-label="Filtrar perícias" placeholder="Filtrar…" value={skillFilter} onChange={(e) => setSkillFilter(e.target.value)} />
                  </div>
                  <p className="muted small">O número de cada perícia é o treino e os outros bônus. O total aparece no modo Jogar.</p>
                  <ul className="skill-list">
                    {system.skills
                      .filter((k) => !skillFilter || fold(k.name).includes(fold(skillFilter)))
                      .map((k) => {
                        const attr = system.attributes.find((a) => a.id === k.attributeId)
                        return (
                          <li key={k.id} className={`skill${(s.skills[k.id] ?? 0) !== 0 ? ' skill-trained' : ''}`}>
                            <span className="skill-roll">
                              <span className="skill-name">{k.name}</span>
                              {attr && <span className="skill-attr">{attr.abbr}</span>}
                            </span>
                            <YearInput label={`Valor de ${k.name}`} value={s.skills[k.id] ?? 0} onChange={(n) => n !== null && set({ skills: { ...s.skills, [k.id]: n } })} />
                          </li>
                        )
                      })}
                  </ul>
                </section>
              )}

              <EditList
                title="Ataques"
                items={s.attacks}
                empty="Nenhum ataque. Adicione no modo Jogar."
                render={(a, edit) => (
                  <>
                    <input className="input" aria-label="Nome do ataque" value={a.name} onChange={(e) => edit({ name: e.target.value })} />
                    <YearInput label={`Bônus de ${a.name}`} value={a.bonus} onChange={(v) => v !== null && edit({ bonus: v })} />
                    <input className="input" aria-label={`Dano de ${a.name}`} placeholder="1d8+4" value={a.damage} onChange={(e) => edit({ damage: e.target.value })} />
                    <input className="input" aria-label={`Crítico de ${a.name}`} placeholder="19/x2" value={a.critical} onChange={(e) => edit({ critical: e.target.value })} />
                  </>
                )}
                onChange={(attacks) => set({ attacks })}
              />
              <EditList
                title="Poderes e magias"
                items={s.abilities}
                empty="Nenhum poder. Adicione no modo Jogar."
                render={(a, edit) => (
                  <>
                    <input className="input" aria-label="Nome do poder" value={a.name} onChange={(e) => edit({ name: e.target.value })} />
                    <YearInput label={`Custo de ${a.name}`} value={a.cost} onChange={(v) => v !== null && edit({ cost: Math.max(0, v) })} />
                    <textarea className="input textarea edit-list-wide" rows={2} aria-label={`O que faz ${a.name}`} value={a.text} onChange={(e) => edit({ text: e.target.value })} />
                  </>
                )}
                onChange={(abilities) => set({ abilities })}
              />
            </>
          ) : (
            <p className="notice small">Sem sistema, a ficha guarda só anotações. Escolha um sistema acima para ter atributos, recursos e rolagens.</p>
          )}

          <Field label="Anotações" wide>
            {(id) => <textarea id={id} className="input textarea" rows={4} value={s.notes} onChange={(e) => set({ notes: e.target.value })} />}
          </Field>
        </>
      )}
    </article>
  )
}

/** Lista editável (ataques, poderes): cada item com seus campos e um botão de tirar. */
function EditList<T extends { id: string }>({ title, items, empty, render, onChange }: { title: string; items: T[]; empty: string; render: (item: T, edit: (c: Partial<T>) => void) => React.ReactNode; onChange: (items: T[]) => void }) {
  return (
    <section className="entity-section">
      <h2 className="section-title">{title}</h2>
      {items.length === 0 ? (
        <p className="muted small">{empty}</p>
      ) : (
        <ul className="edit-list">
          {items.map((it) => (
            <li key={it.id} className="edit-list-row">
              {render(it, (c) => onChange(items.map((x) => (x.id === it.id ? { ...x, ...c } : x))))}
              <button type="button" className="btn-icon btn-sm" aria-label="Tirar" onClick={() => onChange(items.filter((x) => x.id !== it.id))}>
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
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
