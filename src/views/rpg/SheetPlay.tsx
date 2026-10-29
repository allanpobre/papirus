import { Dices, Heart, ImagePlus, Minus, Plus, Search, Sparkles, Swords, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { fold } from '../../logic/text'
import type { GameSystem, Sheet } from '../../model/schema'
import { byId, newId, patch } from '../../model/universe'
import { attributeExpression, bonusLabel, damageExpression, expandFormula, modifier, rollAttribute, rollInitiative, rollSkill } from '../../rpg/rolls'
import { adjustResource, attributeOf, costResource, isPool } from '../../rpg/sheets'
import { Picture } from '../../images/Picture'
import { useImagePicker } from '../../images/useImagePicker'
import { useWorkspace } from '../../state/workspace'
import { Modal } from '../../ui/Modal'
import { useAttack } from './Combat'
import { useRpg } from './rpgContext'

const signed = (n: number) => (n >= 0 ? `+${n}` : String(n))

/**
 * A ficha na hora do jogo: quem é o personagem, vida e mana grandes para mexer com um toque,
 * e tudo que se rola (atributos, perícias, ataques) a um toque, com o bônus à vista para quem
 * rola o dado de verdade. Mudar a estrutura da ficha fica no modo Editar.
 */
export function SheetPlay({ sheet: s, system }: { sheet: Sheet; system: GameSystem }) {
  const { universe, update, toast } = useWorkspace()
  const { report, activeSession } = useRpg()
  const set = (c: Partial<Sheet>) => update((u) => patch(u, 'sheets', s.id, c))
  const entity = s.entityId ? byId(universe, 'entities', s.entityId) : undefined
  const portrait = s.image ?? entity?.image ?? null
  const picker = useImagePicker('retrato', (ref) => set({ image: ref }), (m) => toast(m, { tone: 'erro' }))
  const pools = system.resources.filter(isPool)
  const values = system.resources.filter((r) => !isPool(r))
  const identity = system.fields.map((f) => s.fields[f]?.trim()).filter(Boolean)
  const cost = costResource(system)

  const resource = (id: string) => {
    const def = system.resources.find((r) => r.id === id)
    return s.resources[id] ?? { current: def?.default ?? 0, max: def?.default ?? 0 }
  }
  const change = (id: string, delta: number) => set({ resources: adjustResource({ ...s, resources: { ...s.resources, [id]: resource(id) } }, id, delta) })

  const addToInitiative = () => {
    if (!activeSession) return
    const value = rollInitiative(system, s)
    update((u) => patch(u, 'sessions', activeSession.id, { initiative: [...activeSession.initiative, { id: newId(), name: s.name, value, hp: '', note: '', sheetId: s.id, defense: null, attacks: [], monsterId: null, conditions: [], rolled: true }] }))
    toast(`${s.name} entrou na iniciativa com ${value}`)
  }

  return (
    <div className="sp">
      <section className="sp-hero" aria-label="Quem é">
        {picker.field}
        <button type="button" className="sp-portrait" onClick={picker.open} aria-label={portrait ? 'Trocar o retrato' : 'Pôr um retrato'} title={portrait ? 'Trocar o retrato' : 'Pôr um retrato'}>
          {portrait ? (
            <Picture value={portrait} alt={`Retrato de ${s.name}`} />
          ) : (
            <span className="sp-portrait-empty">
              <span className="sp-initial">{(s.name || '?').trim().charAt(0).toUpperCase()}</span>
              <ImagePlus size={14} aria-hidden="true" />
            </span>
          )}
        </button>
        <div className="sp-who">
          <h2 className="sp-name">{s.name || 'Sem nome'}</h2>
          {identity.length > 0 && <p className="sp-identity">{identity.join(' · ')}</p>}
          <p className="sp-player muted small">{s.role === 'pj' ? (s.player ? `Jogado por ${s.player}` : 'Personagem de jogador') : 'NPC do mestre'}</p>
          {values.length > 0 && (
            <div className="sp-values">
              {values.map((r) => (
                <span key={r.id} className="sp-value" title={r.name}>
                  <span className="sp-value-abbr">{r.abbr}</span>
                  <strong className="tabular">{resource(r.id).current}</strong>
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      {system.features.resources && pools.length > 0 && (
        <section className="sp-pools" aria-label="Vida e recursos">
          {pools.map((r) => (
            <Pool key={r.id} abbr={r.abbr} name={r.name} value={resource(r.id)} onDelta={(d) => change(r.id, d)} />
          ))}
        </section>
      )}

      {system.features.conditions && system.conditions.length > 0 && <Conditions sheet={s} system={system} onChange={(conditions) => set({ conditions })} />}

      {activeSession && system.features.initiative && (
        <button type="button" className="btn btn-ghost btn-sm sp-init" onClick={addToInitiative}>
          <Swords size={14} /> Entrar na iniciativa
        </button>
      )}

      {system.attributes.length > 0 && (
        <section className="sp-block" aria-labelledby={`sp-attr-${s.id}`}>
          <h3 id={`sp-attr-${s.id}`} className="sp-h">
            Atributos <span className="sp-hint">toque para rolar</span>
          </h3>
          <div className="sp-attrs">
            {system.attributes.map((a) => {
              const v = attributeOf(system, s, a.id)
              const expr = attributeExpression(system, s, a.id)
              return (
                <button key={a.id} type="button" className="sp-attr" aria-label={`Rolar ${a.name}: ${bonusLabel(expr)}`} onClick={() => report(rollAttribute(system, s, a.id), s.name)}>
                  <span className="sp-attr-abbr">{a.abbr}</span>
                  <span className="sp-attr-value tabular">{system.modifierRule === 'd20' ? v : signed(v)}</span>
                  {system.modifierRule === 'd20' && <span className="sp-attr-mod tabular">{signed(modifier(system, v))}</span>}
                </button>
              )
            })}
          </div>
        </section>
      )}

      <Attacks sheet={s} system={system} onChange={(attacks) => set({ attacks })} />
      <Abilities sheet={s} costAbbr={cost?.abbr} onUse={(n) => cost && change(cost.id, -n)} onChange={(abilities) => set({ abilities })} />
      {system.skills.length > 0 && <Skills sheet={s} system={system} />}
      <Inventory sheet={s} onChange={(inventory) => set({ inventory })} />

      <section className="sp-block">
        <h3 className="sp-h">
          <label htmlFor={`sp-notas-${s.id}`}>Anotações</label>
        </h3>
        <textarea id={`sp-notas-${s.id}`} className="input textarea" rows={4} value={s.notes} placeholder="Pistas, nomes, dívidas, juramentos…" onChange={(e) => set({ notes: e.target.value })} />
      </section>
    </div>
  )
}

/** Vida, mana… em número grande, com − e + de um toque e "quanto?" para dano ou cura maiores. */
function Pool({ abbr, name, value, onDelta }: { abbr: string; name: string; value: { current: number; max: number }; onDelta: (d: number) => void }) {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const pct = value.max > 0 ? Math.max(0, Math.min(100, (value.current / value.max) * 100)) : 0
  const low = value.max > 0 && value.current <= value.max / 4
  const apply = (sign: 1 | -1) => {
    const n = Math.abs(Number(amount))
    if (!Number.isFinite(n) || n === 0) return
    onDelta(sign * n)
    setAmount('')
    setOpen(false)
  }
  return (
    <div className={`sp-pool${low ? ' is-low' : ''}${value.max > 0 && value.current <= 0 ? ' is-out' : ''}`}>
      <div className="sp-pool-row">
        <button type="button" className="sp-pool-btn" aria-label={`Menos 1 ${abbr}`} onClick={() => onDelta(-1)}>
          <Minus size={18} />
        </button>
        <button type="button" className="sp-pool-main" aria-expanded={open} aria-label={`${name}: ${value.current} de ${value.max}. Tocar para dano ou cura`} onClick={() => setOpen(!open)}>
          <span className="sp-pool-abbr">{abbr}</span>
          <span className="sp-pool-num tabular">
            <strong>{value.current}</strong>
            <span>/{value.max}</span>
          </span>
        </button>
        <button type="button" className="sp-pool-btn" aria-label={`Mais 1 ${abbr}`} onClick={() => onDelta(1)}>
          <Plus size={18} />
        </button>
      </div>
      <span className="sp-pool-bar" aria-hidden="true">
        <span style={{ width: `${pct}%` }} />
      </span>
      {open && (
        <form
          className="sp-pool-adjust"
          onSubmit={(e) => {
            e.preventDefault()
            apply(-1)
          }}
        >
          <input className="input" inputMode="numeric" autoFocus aria-label={`Quanto de ${abbr}`} placeholder="Quanto?" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))} />
          <button type="submit" className="btn btn-sm">
            <Swords size={13} /> Perde
          </button>
          <button type="button" className="btn btn-sm" onClick={() => apply(1)}>
            <Heart size={13} /> Recupera
          </button>
        </form>
      )}
    </div>
  )
}

/** Só as condições que valem agora; as outras ficam num seletor. */
function Conditions({ sheet: s, system, onChange }: { sheet: Sheet; system: GameSystem; onChange: (c: string[]) => void }) {
  const [picking, setPicking] = useState(false)
  const toggle = (c: string) => onChange(s.conditions.includes(c) ? s.conditions.filter((x) => x !== c) : [...s.conditions, c])
  return (
    <section className="sp-conditions" aria-label="Condições">
      {s.conditions.map((c) => (
        <button key={c} type="button" className="chip sp-condition" aria-label={`Tirar a condição ${c}`} onClick={() => toggle(c)}>
          {c} <X size={12} aria-hidden="true" />
        </button>
      ))}
      <button type="button" className="chip sp-condition-add" onClick={() => setPicking(true)}>
        <Plus size={12} aria-hidden="true" /> Condição
      </button>
      {picking && (
        <Modal title="Condições" size="sm" onClose={() => setPicking(false)}>
          <div className="chips">
            {system.conditions.map((c) => (
              <button key={c} type="button" className="chip chip-condition" aria-pressed={s.conditions.includes(c)} onClick={() => toggle(c)}>
                {c}
              </button>
            ))}
          </div>
        </Modal>
      )}
    </section>
  )
}

/** Perícias com o bônus total à vista; as treinadas primeiro. Toque para rolar. */
function Skills({ sheet: s, system }: { sheet: Sheet; system: GameSystem }) {
  const { report } = useRpg()
  const trained = system.skills.filter((k) => (s.skills[k.id] ?? 0) !== 0)
  const [all, setAll] = useState(trained.length === 0)
  const [query, setQuery] = useState('')
  const list = (query || all ? system.skills : trained).filter((k) => !query || fold(k.name).includes(fold(query)))
  return (
    <section className="sp-block" aria-labelledby={`sp-per-${s.id}`}>
      <div className="sp-head">
        <h3 id={`sp-per-${s.id}`} className="sp-h">
          Perícias <span className="sp-hint">toque para rolar</span>
        </h3>
        {trained.length > 0 && (
          <div className="sp-toggle" role="radiogroup" aria-label="Quais perícias">
            <button type="button" role="radio" aria-checked={!all} onClick={() => setAll(false)}>
              Treinadas
            </button>
            <button type="button" role="radio" aria-checked={all} onClick={() => setAll(true)}>
              Todas
            </button>
          </div>
        )}
      </div>
      <label className="sp-search">
        <Search size={14} aria-hidden="true" />
        <input className="input input-sm" data-livre aria-label="Procurar perícia" placeholder="Procurar perícia…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      <ul className="sp-skills">
        {list.map((k) => {
          const attr = system.attributes.find((a) => a.id === k.attributeId)
          const v = s.skills[k.id] ?? 0
          const expr = expandFormula(system.skillFormula, { system, sheet: s, attributeId: k.attributeId, skillValue: v })
          return (
            <li key={k.id}>
              <button type="button" className={`sp-skill${v !== 0 ? ' is-trained' : ''}`} onClick={() => report(rollSkill(system, s, k.id), s.name)}>
                <span className="sp-skill-name">{k.name}</span>
                {attr && <span className="sp-skill-attr">{attr.abbr}</span>}
                <span className="sp-skill-bonus tabular">{bonusLabel(expr)}</span>
              </button>
            </li>
          )
        })}
        {list.length === 0 && <li className="muted small">Nenhuma perícia com esse nome.</li>}
      </ul>
    </section>
  )
}

/**
 * Ataques: o teste e o dano a um toque; a margem de crítico entra na leitura do d20.
 * Em combate, o Papirus pergunta em quem, diz se acerta e oferece tirar o dano da vida do alvo.
 */
function Attacks({ sheet: s, system, onChange }: { sheet: Sheet; system: GameSystem; onChange: (a: Sheet['attacks']) => void }) {
  const { attack, picker } = useAttack()
  const [adding, setAdding] = useState(false)
  const usesD20 = system.resolution === 'total'
  const damageOf = (d: string) => damageExpression(system, s, d)
  const spec = (a: Sheet['attacks'][number]) => ({ name: a.name, bonus: a.bonus, damage: damageOf(a.damage), critical: a.critical })
  return (
    <section className="sp-block" aria-labelledby={`sp-atq-${s.id}`}>
      <div className="sp-head">
        <h3 id={`sp-atq-${s.id}`} className="sp-h">
          Ataques
        </h3>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAdding(true)}>
          <Plus size={14} /> Ataque
        </button>
      </div>
      {s.attacks.length === 0 ? (
        <p className="muted small">Espada, arco, mordida… Com o bônus e o dano, o ataque fica a um toque.</p>
      ) : (
        <ul className="sp-list">
          {s.attacks.map((a) => (
            <li key={a.id} className="sp-attack">
              <span className="sp-item-name">{a.name || 'Ataque'}</span>
              {usesD20 && (
                <button type="button" className="sp-roll" aria-label={`Teste de ${a.name}: ${signed(a.bonus)}`} onClick={() => attack(s.name, spec(a), 'teste', { sheetId: s.id })}>
                  <Dices size={13} aria-hidden="true" /> {signed(a.bonus)}
                </button>
              )}
              {a.damage.trim() && (
                <button type="button" className="sp-roll sp-roll-damage" aria-label={`Dano de ${a.name}: ${damageOf(a.damage)}`} onClick={() => attack(s.name, spec(a), 'dano', { sheetId: s.id })}>
                  {damageOf(a.damage)}
                </button>
              )}
              {a.critical.trim() && <span className="sp-crit muted small">{a.critical}</span>}
              <button type="button" className="btn-icon btn-sm sp-remove" aria-label={`Tirar ${a.name}`} onClick={() => onChange(s.attacks.filter((x) => x.id !== a.id))}>
                <X size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {picker}
      {adding && (
        <Modal title="Novo ataque" size="sm" onClose={() => setAdding(false)}>
          <AttackForm
            usesD20={usesD20}
            onSave={(a) => {
              onChange([...s.attacks, { id: newId(), ...a }])
              setAdding(false)
            }}
          />
        </Modal>
      )}
    </section>
  )
}

function AttackForm({ usesD20, onSave }: { usesD20: boolean; onSave: (a: { name: string; bonus: number; damage: string; critical: string }) => void }) {
  const [name, setName] = useState('')
  const [bonus, setBonus] = useState('')
  const [damage, setDamage] = useState('')
  const [critical, setCritical] = useState('')
  return (
    <form
      className="sp-form"
      onSubmit={(e) => {
        e.preventDefault()
        if (!name.trim()) return
        onSave({ name: name.trim(), bonus: Number(bonus) || 0, damage: damage.trim(), critical: critical.trim() })
      }}
    >
      <label className="field">
        <span className="field-label">Nome</span>
        <input className="input" autoFocus value={name} placeholder="Espada longa" onChange={(e) => setName(e.target.value)} />
      </label>
      {usesD20 && (
        <label className="field">
          <span className="field-label">Bônus do teste</span>
          <input className="input" inputMode="numeric" value={bonus} placeholder="7" onChange={(e) => setBonus(e.target.value.replace(/[^\d-]/g, ''))} />
        </label>
      )}
      <label className="field">
        <span className="field-label">Dano</span>
        <input className="input" value={damage} placeholder="1d8+4" onChange={(e) => setDamage(e.target.value)} />
        <span className="field-hint">Dá para usar atributos: 1d8+{'{FOR}'}</span>
      </label>
      {usesD20 && (
        <label className="field">
          <span className="field-label">Crítico</span>
          <input className="input" value={critical} placeholder="19/x2" onChange={(e) => setCritical(e.target.value)} />
        </label>
      )}
      <button type="submit" className="btn btn-primary">
        Guardar ataque
      </button>
    </form>
  )
}

/** Poderes, magias e habilidades: o texto à mão e "Usar" desconta o custo. */
function Abilities({ sheet: s, costAbbr, onUse, onChange }: { sheet: Sheet; costAbbr?: string; onUse: (n: number) => void; onChange: (a: Sheet['abilities']) => void }) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [cost, setCost] = useState('')
  const [text, setText] = useState('')
  return (
    <section className="sp-block" aria-labelledby={`sp-pod-${s.id}`}>
      <div className="sp-head">
        <h3 id={`sp-pod-${s.id}`} className="sp-h">
          Poderes e magias
        </h3>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAdding(true)}>
          <Plus size={14} /> Poder
        </button>
      </div>
      {s.abilities.length === 0 ? (
        <p className="muted small">Habilidades de classe, magias, truques. {costAbbr ? `"Usar" desconta o custo em ${costAbbr}.` : ''}</p>
      ) : (
        <ul className="sp-list">
          {s.abilities.map((a) => (
            <li key={a.id} className="sp-ability">
              <details>
                <summary>
                  <span className="sp-item-name">{a.name}</span>
                  {a.cost > 0 && costAbbr && (
                    <span className="sp-cost tabular">
                      {a.cost} {costAbbr}
                    </span>
                  )}
                </summary>
                {a.text && <p className="sp-ability-text">{a.text}</p>}
                <button type="button" className="btn-icon btn-sm sp-remove" aria-label={`Tirar ${a.name}`} onClick={() => onChange(s.abilities.filter((x) => x.id !== a.id))}>
                  <X size={13} />
                </button>
              </details>
              {a.cost > 0 && costAbbr && (
                <button type="button" className="btn btn-sm sp-use" aria-label={`Usar ${a.name} (${a.cost} ${costAbbr})`} onClick={() => onUse(a.cost)}>
                  <Sparkles size={13} /> Usar
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {adding && (
        <Modal title="Novo poder ou magia" size="sm" onClose={() => setAdding(false)}>
          <form
            className="sp-form"
            onSubmit={(e) => {
              e.preventDefault()
              if (!name.trim()) return
              onChange([...s.abilities, { id: newId(), name: name.trim(), cost: Math.max(0, Number(cost) || 0), text: text.trim() }])
              setName('')
              setCost('')
              setText('')
              setAdding(false)
            }}
          >
            <label className="field">
              <span className="field-label">Nome</span>
              <input className="input" autoFocus value={name} placeholder="Bola de Fogo" onChange={(e) => setName(e.target.value)} />
            </label>
            {costAbbr && (
              <label className="field">
                <span className="field-label">Custo ({costAbbr})</span>
                <input className="input" inputMode="numeric" value={cost} placeholder="0" onChange={(e) => setCost(e.target.value.replace(/[^\d]/g, ''))} />
              </label>
            )}
            <label className="field">
              <span className="field-label">O que faz</span>
              <textarea className="input textarea" rows={3} value={text} onChange={(e) => setText(e.target.value)} />
            </label>
            <button type="submit" className="btn btn-primary">
              Guardar poder
            </button>
          </form>
        </Modal>
      )}
    </section>
  )
}

/** O que o personagem carrega: nome e quantidade, com − e +. */
function Inventory({ sheet: s, onChange }: { sheet: Sheet; onChange: (i: Sheet['inventory']) => void }) {
  const [name, setName] = useState('')
  const total = useMemo(() => s.inventory.reduce((n, i) => n + i.qty, 0), [s.inventory])
  const qty = (id: string, d: number) => onChange(s.inventory.flatMap((i) => (i.id !== id ? [i] : i.qty + d <= 0 ? [] : [{ ...i, qty: i.qty + d }])))
  return (
    <section className="sp-block" aria-labelledby={`sp-inv-${s.id}`}>
      <h3 id={`sp-inv-${s.id}`} className="sp-h">
        Inventário {total > 0 && <span className="sp-hint">{total} {total === 1 ? 'item' : 'itens'}</span>}
      </h3>
      {s.inventory.length > 0 && (
        <ul className="sp-list">
          {s.inventory.map((i) => (
            <li key={i.id} className="sp-item">
              <span className="sp-item-name">{i.name}</span>
              <span className="sp-qty">
                <button type="button" className="btn-icon btn-sm" aria-label={`Menos um ${i.name}`} onClick={() => qty(i.id, -1)}>
                  <Minus size={13} />
                </button>
                <span className="tabular">{i.qty}</span>
                <button type="button" className="btn-icon btn-sm" aria-label={`Mais um ${i.name}`} onClick={() => qty(i.id, 1)}>
                  <Plus size={13} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <form
        className="sp-add"
        onSubmit={(e) => {
          e.preventDefault()
          const n = name.trim()
          if (!n) return
          // "3 tochas" vira 3 × tochas.
          const m = n.match(/^(\d+)\s*x?\s+(.+)$/i)
          onChange([...s.inventory, { id: newId(), name: m ? m[2] : n, qty: m ? Number(m[1]) : 1 }])
          setName('')
        }}
      >
        <input className="input input-sm" aria-label="Novo item" placeholder="Novo item (ex.: 3 tochas)" value={name} onChange={(e) => setName(e.target.value)} />
        <button type="submit" className="btn btn-sm" aria-label="Guardar item">
          <Plus size={14} />
        </button>
      </form>
    </section>
  )
}
