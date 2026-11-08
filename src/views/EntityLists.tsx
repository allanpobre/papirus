import { Check, ListPlus, MoreHorizontal, Pencil, Plus, Trash2, Users, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { fold } from '../logic/text'
import { addList, addMembers, endMembership, inheritedConflicts, inheritedFields, isPast, listTemplatesFor, listsOf, membersOf, membershipsOf, removeList, removeMembership, setRole, updateList, type EntityList } from '../model/lists'
import { kindLabel, kindPlural } from '../model/labels'
import type { Entity } from '../model/schema'
import { byId, entityName, namesOf, patch } from '../model/universe'
import { useWorkspace } from '../state/workspace'
import { YearInput } from '../ui/bits'
import { ConfirmButton } from '../ui/ConfirmButton'
import { EntityPicker } from '../ui/EntityPicker'
import { Modal } from '../ui/Modal'
import { MoreMenu } from '../ui/MoreMenu'

/** "Faz parte de": as listas em que a ficha está (o clã, a espécie, os habitantes do reino). */
export function MembershipChips({ entity: e, editable = false }: { entity: Entity; editable?: boolean }) {
  const { universe, update, peek } = useWorkspace()
  const ms = membershipsOf(universe, e.id)
  if (!ms.length) return null
  return (
    <div className="memberships" aria-label="Faz parte de">
      <span className="memberships-label">Faz parte de</span>
      {ms.map(({ relation: r, owner, list }) => (
        <span key={r.id} className={`chip chip-entity${isPast(r) ? ' is-past' : ''}`} title={isPast(r) ? `Até ${r.scope.toYear}` : undefined}>
          <button type="button" className="chip-link" onClick={() => peek(owner.id)}>
            {owner.name || 'Sem nome'}
            <span className="chip-sub">
              {' '}
              · {list.name}
              {r.role ? `, ${r.role}` : ''}
              {isPast(r) ? `, até ${r.scope.toYear}` : ''}
            </span>
          </button>
          {editable && (
            <button type="button" className="chip-x" aria-label={`Sair de ${list.name} de ${owner.name}`} onClick={() => update((u) => removeMembership(u, r.id))}>
              <X size={12} />
            </button>
          )}
        </span>
      ))}
    </div>
  )
}

/** As listas de uma ficha (Raças, Criaturas, Membros…), para editar. */
export function ListsSection({ entity: e }: { entity: Entity }) {
  const { universe, update } = useWorkspace()
  const lists = listsOf(e)
  const suggested = listTemplatesFor(universe, e.kind).filter((n) => !lists.some((l) => fold(l.name) === fold(n)))
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')
  const [adding, setAdding] = useState<EntityList | null>(null)
  const create = (n: string) => {
    if (!n.trim()) return
    update((u) => addList(u, e.id, n)[0])
    setName('')
    setNaming(false)
  }
  return (
    <section className="entity-section entity-lists" aria-label="Listas">
      <div className="section-head">
        <h2 className="section-title">Listas</h2>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setNaming(true)}>
          <ListPlus size={14} /> Lista
        </button>
      </div>
      {lists.length === 0 && !naming && <p className="muted small">Junte outras fichas aqui, com o nome que quiser: “Raças”, “Criaturas”, “Membros”, “Fiéis”. O que todos de uma lista têm aparece na ficha de cada um.</p>}
      {(naming || suggested.length > 0) && (
        <div className="lists-new">
          {suggested.map((n) => (
            <button key={n} type="button" className="chip chip-add" onClick={() => create(n)}>
              <Plus size={12} /> {n}
            </button>
          ))}
          {naming ? (
            <form
              className="inline-fields"
              onSubmit={(ev) => {
                ev.preventDefault()
                create(name)
              }}
            >
              <label htmlFor={`nova-lista-${e.id}`} className="sr-only">
                Nome da lista
              </label>
              <input id={`nova-lista-${e.id}`} className="input input-sm" autoFocus placeholder="Ex.: Fiéis, Cidades, Exércitos" value={name} onChange={(ev) => setName(ev.target.value)} />
              <button type="submit" className="btn btn-primary btn-sm" disabled={!name.trim()}>
                Criar lista
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setNaming(false)}>
                Cancelar
              </button>
            </form>
          ) : null}
        </div>
      )}
      {lists.map((l) => (
        <ListCard key={l.id} owner={e} list={l} onAdd={() => setAdding(l)} />
      ))}
      {adding && <MemberPicker owner={e} list={adding} onClose={() => setAdding(null)} />}
    </section>
  )
}

function ListCard({ owner, list, onAdd }: { owner: Entity; list: EntityList; onAdd: () => void }) {
  const { universe, update } = useWorkspace()
  const members = membersOf(universe, owner.id, list.id)
  const [editing, setEditing] = useState<string | null>(null)
  const setList = (changes: Partial<Omit<EntityList, 'id'>>) => update((u) => updateList(u, owner.id, list.id, changes))
  return (
    <article className="list-card" aria-label={list.name}>
      <header className="list-card-head">
        <input className="list-name" aria-label="Nome da lista" value={list.name} onChange={(ev) => setList({ name: ev.target.value })} />
        <span className="muted small">
          {members.filter((m) => !isPast(m.relation)).length}
          {members.some((m) => isPast(m.relation)) && ` · ${members.filter((m) => isPast(m.relation)).length} ex`}
        </span>
        <button type="button" className="btn btn-primary btn-sm" onClick={onAdd}>
          <Plus size={14} /> Adicionar
        </button>
        <MoreMenu label={`Mais da lista ${list.name}`} button={<MoreHorizontal size={16} aria-label={`Mais da lista ${list.name}`} />}>
          {(close) => (
            <>
              <div className="more-menu-note">
                <span className="small muted">Aceita</span>
                <KindToggles value={list.accepts} onChange={(accepts) => setList({ accepts })} />
              </div>
              <ConfirmButton
                className="more-menu-item more-menu-danger"
                question={`Tirar a lista “${list.name}”? As fichas ficam; só deixam de fazer parte dela.`}
                confirmLabel="Tirar a lista"
                onConfirm={() => {
                  close()
                  update((u) => removeList(u, owner.id, list.id))
                }}
              >
                <Trash2 size={16} /> Tirar a lista
              </ConfirmButton>
            </>
          )}
        </MoreMenu>
      </header>
      <SharedEditor list={list} onChange={(shared) => setList({ shared })} />
      {members.length === 0 ? (
        <p className="muted small">Ninguém ainda. “Adicionar” abre a lista de fichas com caixinhas.</p>
      ) : (
        <ul className="list-members">
          {members.map(({ relation: r, member }) => (
            <li key={r.id} className={isPast(r) ? 'is-past' : undefined}>
              {editing === r.id ? (
                <span className="member-edit">
                  <strong>{member.name}</strong>
                  <input className="input input-sm" aria-label={`Papel de ${member.name}`} placeholder="Papel: líder, rainha…" defaultValue={r.role ?? ''} onBlur={(ev) => update((u) => setRole(u, r.id, ev.target.value))} />
                  <YearInput label={`${member.name} saiu no ano`} placeholder="Saiu no ano" value={r.scope.toYear} onChange={(y) => update((u) => endMembership(u, r.id, y))} />
                  <button type="button" className="btn-icon btn-sm" aria-label={`Tirar ${member.name} da lista`} onClick={() => update((u) => removeMembership(u, r.id))}>
                    <Trash2 size={14} />
                  </button>
                  <button type="button" className="btn-icon btn-sm" aria-label="Pronto" onClick={() => setEditing(null)}>
                    <Check size={14} />
                  </button>
                </span>
              ) : (
                <span className="member-line">
                  <MemberLink id={member.id} />
                  {r.role && <span className="role-chip">{r.role}</span>}
                  {isPast(r) && <span className="muted small">até {r.scope.toYear}</span>}
                  <button type="button" className="btn-icon btn-sm member-edit-btn" aria-label={`Papel e saída de ${member.name}`} onClick={() => setEditing(r.id)}>
                    <Pencil size={12} />
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}

function MemberLink({ id }: { id: string }) {
  const { universe, peek } = useWorkspace()
  return (
    <button type="button" className="link-btn member-name" onClick={() => peek(id)}>
      {entityName(universe, id) || 'Sem nome'}
    </button>
  )
}

/** "Todos têm": o que passa para cada ficha da lista. */
function SharedEditor({ list, onChange }: { list: EntityList; onChange: (shared: EntityList['shared']) => void }) {
  const [open, setOpen] = useState(list.shared.length > 0)
  if (!open)
    return (
      <button type="button" className="link-btn small shared-add" onClick={() => setOpen(true)}>
        + O que todos desta lista têm
      </button>
    )
  return (
    <div className="shared-box">
      <span className="small muted">Todos têm (aparece na ficha de cada um):</span>
      {list.shared.map((s, i) => (
        <div key={i} className="kv-row">
          <input className="input input-sm" aria-label="Campo que todos têm" placeholder="Campo" value={s.key} onChange={(ev) => onChange(list.shared.map((x, j) => (j === i ? { ...x, key: ev.target.value } : x)))} />
          <input
            className="input input-sm"
            aria-label={`Valor de ${s.key || 'campo'} para todos`}
            placeholder="Valor"
            value={s.value}
            onChange={(ev) => onChange(list.shared.map((x, j) => (j === i ? { ...x, value: ev.target.value } : x)))}
          />
          <button type="button" className="btn-icon btn-sm" aria-label="Tirar o campo" onClick={() => onChange(list.shared.filter((_, j) => j !== i))}>
            <X size={14} />
          </button>
        </div>
      ))}
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange([...list.shared, { key: '', value: '' }])}>
        <Plus size={14} /> Campo para todos
      </button>
    </div>
  )
}

function KindToggles({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const { universe } = useWorkspace()
  const kinds = [...new Set(['personagem', 'especie', 'lugar', 'faccao', ...universe.entities.map((x) => x.kind)])]
  return (
    <span className="chips">
      <button type="button" className="chip" aria-pressed={value.length === 0} onClick={() => onChange([])}>
        Qualquer tipo
      </button>
      {kinds.map((k) => (
        <button key={k} type="button" className="chip" aria-pressed={value.includes(k)} onClick={() => onChange(value.includes(k) ? value.filter((x) => x !== k) : [...value, k])}>
          {kindPlural(k)}
        </button>
      ))}
    </span>
  )
}

/** Adicionar várias fichas a uma lista: busca, filtros e caixinhas. */
export function MemberPicker({ owner, list, onClose }: { owner: Entity; list: EntityList; onClose: () => void }) {
  const { universe, undoable } = useWorkspace()
  const [query, setQuery] = useState('')
  const [onlyAccepted, setOnlyAccepted] = useState(list.accepts.length > 0)
  const [onlyLoose, setOnlyLoose] = useState(false)
  const [tag, setTag] = useState<string | null>(null)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [role, setRoleText] = useState('')
  const [fromYear, setFromYear] = useState<number | null>(null)
  const inList = useMemo(() => new Set(membersOf(universe, owner.id, list.id).map((m) => m.member.id)), [universe, owner.id, list.id])
  // "Ainda sem lista": quem não faz parte de nenhuma lista de uma ficha do mesmo tipo desta (outro clã, outro reino).
  const inSameKind = useMemo(() => new Set(universe.relations.filter((r) => r.listId && byId(universe, 'entities', r.toId)?.kind === owner.kind).map((r) => r.fromId)), [universe, owner.kind])
  const tags = useMemo(() => [...new Set(universe.entities.flatMap((x) => x.tags))].slice(0, 8), [universe.entities])
  const options = universe.entities
    .filter((x) => x.id !== owner.id && !inList.has(x.id))
    .filter((x) => !onlyAccepted || list.accepts.includes(x.kind))
    .filter((x) => !onlyLoose || !inSameKind.has(x.id))
    .filter((x) => !tag || x.tags.includes(tag))
    .filter((x) => !query.trim() || namesOf(x).some((n) => fold(n).includes(fold(query.trim()))) || x.tags.some((t) => fold(t).includes(fold(query.trim()))))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt'))
  const allPicked = options.length > 0 && options.every((x) => picked.has(x.id))
  const toggle = (id: string) => setPicked((p) => (p.has(id) ? new Set([...p].filter((x) => x !== id)) : new Set([...p, id])))
  const run = () => {
    const ids = [...picked]
    undoable(`${ids.length === 1 ? '1 ficha' : `${ids.length} fichas`} em ${list.name} de ${owner.name}`, (u) => addMembers(u, owner.id, list.id, ids, { role, fromYear }))
    onClose()
  }
  return (
    <Modal
      title={`Adicionar a ${list.name} de ${owner.name || 'Sem nome'}`}
      onClose={onClose}
      footer={
        <>
          <span className="muted small replace-foot-note">
            Cada um passa a mostrar “Faz parte de: {owner.name} · {list.name}”.
          </span>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn btn-primary" disabled={!picked.size} onClick={run}>
            {picked.size ? `Adicionar ${picked.size}` : 'Adicionar'}
          </button>
        </>
      }
    >
      <input className="input" autoFocus aria-label="Procurar fichas" placeholder="Procurar: nome, apelido, etiqueta…" value={query} onChange={(ev) => setQuery(ev.target.value)} />
      <div className="chips picker-filters">
        {list.accepts.length > 0 && (
          <button type="button" className="chip" aria-pressed={onlyAccepted} onClick={() => setOnlyAccepted(!onlyAccepted)}>
            {list.accepts.map(kindPlural).join(', ')}
          </button>
        )}
        <button type="button" className="chip" aria-pressed={onlyLoose} onClick={() => setOnlyLoose(!onlyLoose)}>
          Ainda sem {kindLabel(owner.kind).toLowerCase()}
        </button>
        {tags.map((t) => (
          <button key={t} type="button" className="chip" aria-pressed={tag === t} onClick={() => setTag(tag === t ? null : t)}>
            #{t}
          </button>
        ))}
      </div>
      <label className="check picker-all">
        <input type="checkbox" checked={allPicked} onChange={(ev) => setPicked(ev.target.checked ? new Set([...picked, ...options.map((x) => x.id)]) : new Set([...picked].filter((id) => !options.some((x) => x.id === id))))} />
        Marcar {options.length === 1 ? 'a 1' : `as ${options.length}`} da lista
      </label>
      <ul className="member-pick-list" aria-label="Fichas">
        {options.map((x) => (
          <li key={x.id}>
            <label className="check">
              <input type="checkbox" checked={picked.has(x.id)} onChange={() => toggle(x.id)} />
              <span className="picker-name">{x.name || 'Sem nome'}</span>
              <span className="muted small">{membershipsOf(universe, x.id)[0]?.owner.name ?? kindLabel(x.kind)}</span>
            </label>
          </li>
        ))}
        {options.length === 0 && <li className="muted small">Nada com esse filtro.</li>}
      </ul>
      <div className="inline-fields picker-extra">
        <label className="inline-label">
          Papel (opcional)
          <input className="input input-sm" value={role} placeholder="membro, soldado…" onChange={(ev) => setRoleText(ev.target.value)} />
        </label>
        <label className="inline-label">
          Desde o ano
          <YearInput label="Desde o ano" placeholder="—" value={fromYear} onChange={setFromYear} />
        </label>
      </div>
    </Modal>
  )
}

/** As linhas que a ficha recebe das listas, com a origem; "Mudar só nela" cria o campo próprio. */
export function InheritedRows({ entity: e }: { entity: Entity }) {
  const { universe, update } = useWorkspace()
  // Campo próprio vazio (o do modelo do tipo) não muda o que vem da lista.
  const own = new Set(e.fields.filter((f) => f.value.trim() || f.ref).map((f) => fold(f.key.trim())))
  const rows = inheritedFields(universe, e.id)
  const conflicts = inheritedConflicts(universe, e.id)
  if (!rows.length) return null
  return (
    <div className="inherited" aria-label="Vem das listas">
      {rows.map((r) => {
        const overridden = own.has(fold(r.key.trim()))
        return (
          <div key={`${r.ownerId}-${r.key}`} className={`inherited-row${overridden ? ' is-overridden' : ''}`}>
            <span className="inherited-key">{r.key}</span>
            <span className="inherited-value">{r.value}</span>
            <span className="muted small inherited-from">
              {overridden ? 'diferente nesta ficha' : `de ${entityName(universe, r.ownerId)}`}
              {r.via.length > 0 && !overridden && `, por ${r.via.map((id) => entityName(universe, id)).join(' › ')}`}
            </span>
            {!overridden && (
              <button type="button" className="link-btn small" onClick={() => update((u) => patch(u, 'entities', e.id, { fields: [...e.fields, { key: r.key, value: r.value }] }))}>
                Mudar só nesta
              </button>
            )}
          </div>
        )
      })}
      {conflicts.map((c) => (
        <p key={c.key} className="notice small">
          {c.owners.map((id) => entityName(universe, id)).join(' e ')} dizem coisas diferentes para “{c.key}”. Vale a primeira; para escolher, mude só nesta ficha.
        </p>
      ))}
    </div>
  )
}

/** Para a seleção do Mundo: pôr várias fichas numa lista de outra ficha. */
export function PutInListDialog({ ids, onClose, onDone }: { ids: string[]; onClose: () => void; onDone: () => void }) {
  const { universe, undoable } = useWorkspace()
  const [ownerId, setOwnerId] = useState<string | null>(null)
  const owner = ownerId ? byId(universe, 'entities', ownerId) : undefined
  const lists = listsOf(owner)
  const [listId, setListId] = useState<string>('')
  const [newName, setNewName] = useState('')
  const chosen = lists.find((l) => l.id === listId) ?? (lists.length === 1 ? lists[0] : undefined)
  const run = () => {
    if (!owner) return
    undoable(`${ids.length} fichas em ${chosen?.name ?? newName} de ${owner.name}`, (u) => {
      let next = u
      let target = chosen
      if (!target) [next, target] = addList(next, owner.id, newName.trim() || 'Membros')
      return addMembers(next, owner.id, target.id, ids)
    })
    onDone()
  }
  return (
    <Modal
      title={`Pôr ${ids.length === 1 ? '1 ficha' : `${ids.length} fichas`} numa lista`}
      size="sm"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn btn-primary" disabled={!owner || (!chosen && !newName.trim())} onClick={run}>
            <Users size={15} /> Pôr na lista
          </button>
        </>
      }
    >
      <EntityPicker label="Na ficha de" value={ownerId} exclude={ids} onChange={(v) => setOwnerId(v)} placeholder="Ostria, Clã do Corvo, Elfo…" allowCreate={false} />
      {owner && lists.length > 0 && (
        <div className="field">
          <span className="field-label">Lista</span>
          <div className="chips" role="radiogroup" aria-label="Lista">
            {lists.map((l) => (
              <button key={l.id} type="button" role="radio" className="chip" aria-checked={chosen?.id === l.id} onClick={() => setListId(l.id)}>
                {l.name}
              </button>
            ))}
          </div>
        </div>
      )}
      {owner && !chosen && (
        <label className="field">
          <span className="field-label">{lists.length ? 'Ou uma lista nova' : 'Nome da lista nova'}</span>
          <input className="input" value={newName} placeholder="Membros, Habitantes, Raças…" onChange={(ev) => setNewName(ev.target.value)} />
        </label>
      )}
    </Modal>
  )
}
