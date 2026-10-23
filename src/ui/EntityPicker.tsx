import { Plus, X } from 'lucide-react'
import { useId, useMemo, useRef, useState } from 'react'
import { fold } from '../logic/text'
import { kindLabel } from '../model/labels'
import type { Entity } from '../model/schema'
import { draftEntity, entityName, insert, namesOf } from '../model/universe'
import { useWorkspace } from '../state/workspace'

interface Props {
  value: string | null
  onChange: (id: string | null) => void
  /** Tipos aceitos. Vazio = todos. O primeiro é usado ao criar uma ficha nova. */
  kinds?: string[]
  placeholder?: string
  label: string
  /** Esconde o rótulo visualmente (continua acessível). */
  hideLabel?: boolean
  exclude?: string[]
  allowCreate?: boolean
}

/**
 * Escolha de ficha com busca. Se o nome não existir, oferece criar uma ficha
 * mínima em rascunho, sem sair do lugar.
 */
export function EntityPicker({
  value,
  onChange,
  kinds = [],
  placeholder = 'Buscar ficha…',
  label,
  hideLabel,
  exclude = [],
  allowCreate = true,
}: Props) {
  const { universe, update } = useWorkspace()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const listId = useId()
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)

  const options = useMemo(() => {
    const q = fold(query.trim())
    return universe.entities
      .filter((e) => (kinds.length === 0 || kinds.includes(e.kind)) && !exclude.includes(e.id))
      .filter((e) => !q || namesOf(e).some((n) => fold(n).includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt'))
      .slice(0, 50)
  }, [universe.entities, kinds, exclude, query])

  const exact = options.some((e) => namesOf(e).some((n) => fold(n) === fold(query.trim())))
  const canCreate = allowCreate && query.trim() !== '' && !exact
  const total = options.length + (canCreate ? 1 : 0)

  const choose = (e: Entity | null) => {
    onChange(e ? e.id : null)
    setQuery('')
    setOpen(false)
  }

  const create = () => {
    const name = query.trim()
    let created: Entity | undefined
    update((u) => {
      const [next, e] = insert(u, 'entities', draftEntity(kinds[0] ?? 'personagem', name))
      created = e
      return next
    })
    if (created) choose(created)
  }

  const selected = value ? entityName(universe, value) : ''

  return (
    <div className="picker">
      <label htmlFor={inputId} className={hideLabel ? 'sr-only' : 'field-label'}>
        {label}
      </label>
      {value && !open ? (
        <div className="picker-value">
          <button type="button" className="chip chip-entity" onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus()) }}>
            {selected || 'Ficha removida'}
          </button>
          <button type="button" className="btn-icon btn-sm" aria-label={`Limpar ${label}`} onClick={() => onChange(null)}>
            <X size={14} />
          </button>
        </div>
      ) : (
        <div className="picker-box">
          <input
            ref={inputRef}
            id={inputId}
            className="input"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={open && total ? `${listId}-${active}` : undefined}
            placeholder={placeholder}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setOpen(true)
                setActive((a) => Math.min(a + 1, total - 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActive((a) => Math.max(a - 1, 0))
              } else if (e.key === 'Enter' && open && total) {
                e.preventDefault()
                if (active < options.length) choose(options[active])
                else create()
              } else if (e.key === 'Escape' && open) {
                e.stopPropagation()
                setOpen(false)
              }
            }}
          />
          {open && total > 0 && (
            <ul className="picker-list" role="listbox" id={listId}>
              {options.map((e, i) => (
                <li
                  key={e.id}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  className={i === active ? 'active' : undefined}
                  onMouseDown={(ev) => {
                    ev.preventDefault()
                    choose(e)
                  }}
                >
                  <span>{e.name || 'Sem nome'}</span>
                  <span className="muted small">{kindLabel(e.kind)}</span>
                </li>
              ))}
              {canCreate && (
                <li
                  id={`${listId}-${options.length}`}
                  role="option"
                  aria-selected={active === options.length}
                  className={active === options.length ? 'active picker-create' : 'picker-create'}
                  onMouseDown={(ev) => {
                    ev.preventDefault()
                    create()
                  }}
                >
                  <Plus size={14} /> Criar “{query.trim()}”{kinds[0] ? ` (${kindLabel(kinds[0]).toLowerCase()})` : ''}
                </li>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

/** Vários vínculos a fichas, como chips. */
export function EntityMultiPicker({
  value,
  onChange,
  label,
  kinds,
  placeholder = 'Adicionar…',
}: {
  value: string[]
  onChange: (ids: string[]) => void
  label: string
  kinds?: string[]
  placeholder?: string
}) {
  const { universe, peek } = useWorkspace()
  return (
    <div className="multi-picker">
      <span className="field-label">{label}</span>
      <div className="chips">
        {value.map((id) => (
          <span key={id} className="chip chip-entity">
            <button type="button" className="chip-link" onClick={() => peek(id)}>
              {entityName(universe, id) || 'Ficha removida'}
            </button>
            <button
              type="button"
              className="chip-x"
              aria-label={`Remover ${entityName(universe, id)}`}
              onClick={() => onChange(value.filter((x) => x !== id))}
            >
              <X size={12} />
            </button>
          </span>
        ))}
      </div>
      <EntityPicker
        label={`Adicionar a ${label.toLowerCase()}`}
        hideLabel
        value={null}
        kinds={kinds}
        exclude={value}
        placeholder={placeholder}
        onChange={(id) => id && onChange([...value, id])}
      />
    </div>
  )
}
