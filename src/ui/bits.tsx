import { X } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import { CANON_HINT, CANON_LABEL, CANON_ORDER, EDITORIAL_LABEL } from '../model/labels'
import { EDITORIAL_STATES, type Canon, type Editorial } from '../model/schema'

export function CanonBadge({ canon }: { canon: Canon }) {
  return (
    <span className={`badge canon-${canon}`} title={CANON_HINT[canon]}>
      {CANON_LABEL[canon]}
    </span>
  )
}

export function EditorialBadge({ editorial }: { editorial: Editorial }) {
  return <span className={`badge editorial editorial-${editorial}`}>{EDITORIAL_LABEL[editorial]}</span>
}

export function Field({
  label,
  children,
  hint,
  wide,
}: {
  label: string
  children: (id: string) => ReactNode
  hint?: string
  wide?: boolean
}) {
  const id = useId()
  return (
    <div className={wide ? 'field field-wide' : 'field'}>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      {children(id)}
      {hint && <span className="field-hint">{hint}</span>}
    </div>
  )
}

export function Select<T extends string>({
  id,
  value,
  onChange,
  options,
  label,
}: {
  id?: string
  value: T
  onChange: (v: T) => void
  options: readonly T[] | { value: T; label: string }[]
  label?: string
}) {
  const opts = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o))
  return (
    <select id={id} aria-label={label} className="input select" value={value} onChange={(e) => onChange(e.target.value as T)}>
      {opts.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

export function CanonSelect({ id, value, onChange }: { id?: string; value: Canon; onChange: (v: Canon) => void }) {
  return (
    <Select
      id={id}
      label="É verdade no mundo?"
      value={value}
      onChange={onChange}
      options={CANON_ORDER.map((c) => ({ value: c, label: c === 'secreto' ? 'Segredo (verdade escondida)' : CANON_LABEL[c] }))}
    />
  )
}

export function EditorialSelect({ id, value, onChange, label = 'Quão pronta' }: { id?: string; value: Editorial; onChange: (v: Editorial) => void; label?: string }) {
  return (
    <Select
      id={id}
      label={label}
      value={value}
      onChange={onChange}
      options={EDITORIAL_STATES.map((c) => ({ value: c, label: EDITORIAL_LABEL[c] }))}
    />
  )
}

/** Lista de etiquetas livres. Enter ou vírgula adicionam. */
export function TagInput({
  value,
  onChange,
  label,
  placeholder = 'Adicionar…',
}: {
  value: string[]
  onChange: (v: string[]) => void
  label: string
  placeholder?: string
}) {
  const [draft, setDraft] = useState('')
  const id = useId()
  const add = () => {
    const t = draft.trim().replace(/,$/, '')
    if (t && !value.includes(t)) onChange([...value, t])
    setDraft('')
  }
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <div className="tag-input">
        {value.map((t) => (
          <span key={t} className="chip">
            {t}
            <button type="button" className="chip-x" aria-label={`Remover ${t}`} onClick={() => onChange(value.filter((x) => x !== t))}>
              <X size={12} />
            </button>
          </span>
        ))}
        <input
          id={id}
          className="tag-input-field"
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={add}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault()
              add()
            } else if (e.key === 'Backspace' && !draft && value.length) {
              onChange(value.slice(0, -1))
            }
          }}
        />
      </div>
    </div>
  )
}

export function Empty({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      {icon && <div className="empty-icon">{icon}</div>}
      <p className="empty-title">{title}</p>
      {children && <div className="empty-body">{children}</div>}
    </div>
  )
}

/** Campo de ano opcional: vazio vira `null`. */
export function YearInput({
  id,
  value,
  onChange,
  placeholder = 'Ano',
  label,
}: {
  id?: string
  value: number | null
  onChange: (v: number | null) => void
  placeholder?: string
  label?: string
}) {
  return (
    <input
      id={id}
      aria-label={label}
      className="input input-year"
      inputMode="numeric"
      placeholder={placeholder}
      value={value ?? ''}
      onChange={(e) => {
        const v = e.target.value.trim()
        if (v === '' || v === '-') return onChange(null)
        const n = Number(v)
        if (Number.isFinite(n)) onChange(Math.trunc(n))
      }}
    />
  )
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>
}
