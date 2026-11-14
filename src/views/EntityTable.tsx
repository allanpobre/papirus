import { ArrowDown, ArrowUp, Columns3, Pencil } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ageIn } from '../logic/age'
import { unmarkReveals } from '../logic/reveals'
import { fold } from '../logic/text'
import { derivedValue } from '../logic/derivedFields'
import { inheritedFields, membershipsOf } from '../model/lists'
import { kindLabel } from '../model/labels'
import type { Entity } from '../model/schema'
import { patch } from '../model/universe'
import { recall, remember } from '../state/prefs'
import { useWorkspace } from '../state/workspace'
import { MoreMenu } from '../ui/MoreMenu'

type Col = { id: string; label: string; editable: boolean }

/**
 * As fichas lado a lado: uma linha por ficha, uma coluna por campo (os próprios e os que vêm das
 * listas), as listas de que fazem parte, a idade num ano e quantas cenas. Ordena por qualquer
 * coluna e edita na célula. As colunas escolhidas ficam lembradas por tipo.
 */
export function EntityTable({ rows, kind, counts, onOpen }: { rows: Entity[]; kind: string; counts: Map<string, number>; onOpen: (id: string) => void }) {
  const { universe, update, readOnly } = useWorkspace()
  // O "agora" da história: o ano mais tardio das cenas com data.
  const now = useMemo(() => {
    const years = universe.scenes.map((s) => s.date?.year).filter((y): y is number => typeof y === 'number')
    return years.length ? Math.max(...years) : null
  }, [universe.scenes])
  const inherited = useMemo(() => new Map(rows.map((e) => [e.id, inheritedFields(universe, e.id)])), [rows, universe])
  // Os campos, dos mais usados para os menos.
  const fieldKeys = useMemo(() => {
    const freq = new Map<string, { label: string; n: number }>()
    for (const e of rows) {
      const keys = [...e.fields.map((f) => f.key), ...(inherited.get(e.id) ?? []).map((i) => i.key)].filter((k) => k.trim())
      for (const k of new Set(keys.map((x) => x.trim()))) {
        const id = fold(k)
        const cur = freq.get(id) ?? { label: k, n: 0 }
        cur.n++
        freq.set(id, cur)
      }
    }
    return [...freq.entries()].sort((a, b) => b[1].n - a[1].n).map(([id, v]) => ({ id: `campo:${id}`, label: v.label, editable: true }))
  }, [rows, inherited])
  const hasAge = now !== null && rows.some((e) => e.startYear !== null)
  const all: Col[] = [
    ...(kind === 'todos' ? [{ id: 'tipo', label: 'Tipo', editable: false }] : []),
    { id: 'parte', label: 'Faz parte de', editable: false },
    ...(hasAge ? [{ id: 'idade', label: `Idade em ${now}`, editable: false }] : []),
    ...fieldKeys,
    { id: 'cenas', label: 'Cenas', editable: false },
  ]
  const storeKey = `tabela-colunas:${universe.id}:${kind}`
  const [chosen, setChosen] = useState<string[] | null>(() => {
    try {
      const raw = recall(storeKey)
      return raw ? (JSON.parse(raw) as string[]) : null
    } catch {
      return null
    }
  })
  // Sem escolha guardada: as listas, a idade, os quatro campos mais usados e as cenas.
  const visible = all.filter((c) => (chosen ? chosen.includes(c.id) : !c.id.startsWith('campo:') || fieldKeys.indexOf(c) < 4))
  const choose = (ids: string[]) => {
    setChosen(ids)
    remember(storeKey, JSON.stringify(ids))
  }
  const [sort, setSort] = useState<{ col: string; dir: 1 | -1 }>({ col: 'nome', dir: 1 })
  const [editing, setEditing] = useState<{ id: string; col: string } | null>(null)

  // O valor da célula: o da ficha; se vazio, o da lista ("de Ostria"); se não, o que as ligações ou o nascimento dizem.
  const fieldValue = (e: Entity, key: string): { value: string; from?: string } => {
    const own = e.fields.find((f) => fold(f.key.trim()) === key)
    if (own && (own.value.trim() || own.ref)) return { value: own.value }
    const inh = (inherited.get(e.id) ?? []).find((i) => fold(i.key.trim()) === key)
    if (inh) return { value: inh.value, from: `de ${universe.entities.find((x) => x.id === inh.ownerId)?.name ?? 'uma lista'}` }
    const derived = own ? derivedValue(universe, e, own.key) : null
    return derived ? { value: derived.text, from: derived.via } : { value: '' }
  }
  const text = (e: Entity, col: string): string => {
    if (col === 'nome') return e.name
    if (col === 'tipo') return kindLabel(e.kind)
    if (col === 'parte')
      return membershipsOf(universe, e.id)
        .map((m) => `${m.owner.name}${m.relation.role ? ` · ${m.relation.role}` : ''}`)
        .join(', ')
    if (col === 'idade') return String(ageIn(e, now) ?? '')
    if (col === 'cenas') return String(counts.get(e.id) ?? 0)
    return fieldValue(e, col.slice('campo:'.length)).value
  }
  // O valor de cada célula, calculado uma vez por linha e coluna (e não a cada desenho e a cada comparação da ordem):
  // com o livro inteiro são centenas de células, e achar o valor de uma (listas, ligações, nascimento) não é de graça.
  const visibleKey = visible.map((c) => c.id).join('|')
  const grid = useMemo(() => {
    const out = new Map<string, Map<string, { value: string; shown: string; from?: string }>>()
    const cols = ['nome', ...visible.map((c) => c.id)]
    for (const e of rows) {
      const row = new Map<string, { value: string; shown: string; from?: string }>()
      for (const col of cols) {
        const f = col.startsWith('campo:') ? fieldValue(e, col.slice('campo:'.length)) : null
        const value = f ? f.value : text(e, col)
        row.set(col, { value, shown: unmarkReveals(value), from: f?.from })
      }
      out.set(e.id, row)
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, visibleKey, universe, now, inherited, counts])
  const sorted = useMemo(
    () => [...rows].sort((a, b) => sort.dir * (grid.get(a.id)?.get(sort.col)?.value ?? '').localeCompare(grid.get(b.id)?.get(sort.col)?.value ?? '', 'pt', { numeric: true, sensitivity: 'base' }) || a.name.localeCompare(b.name, 'pt')),
    [rows, sort, grid],
  )

  const commit = (e: Entity, col: string, value: string) => {
    setEditing(null)
    if (col === 'nome') return update((u) => patch(u, 'entities', e.id, { name: value }))
    const key = col.slice('campo:'.length)
    const label = fieldKeys.find((c) => c.id === col)?.label ?? key
    const has = e.fields.some((f) => fold(f.key.trim()) === key)
    if (!has && !value.trim()) return
    update((u) =>
      patch(u, 'entities', e.id, {
        fields: has ? e.fields.map((f) => (fold(f.key.trim()) === key ? { ...f, value } : f)) : [...e.fields, { key: label, value }],
      }),
    )
  }

  const header = (id: string, label: string) => (
    <th key={id} scope="col" aria-sort={sort.col === id ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className="table-sort" onClick={() => setSort({ col: id, dir: sort.col === id ? (sort.dir === 1 ? -1 : 1) : 1 })}>
        {label}
        {sort.col === id && (sort.dir === 1 ? <ArrowUp size={12} aria-hidden="true" /> : <ArrowDown size={12} aria-hidden="true" />)}
      </button>
    </th>
  )

  const cell = (e: Entity, c: Col) => {
    const isEditing = editing?.id === e.id && editing.col === c.id
    const g = grid.get(e.id)?.get(c.id)
    const f = g && g.from !== undefined ? { value: g.value, from: g.from } : c.id.startsWith('campo:') ? { value: g?.value ?? '', from: undefined as string | undefined } : null
    if (isEditing)
      return (
        <td key={c.id} className="is-editing">
          <input
            className="input input-sm"
            autoFocus
            aria-label={`${c.label} de ${e.name}`}
            defaultValue={f?.from ? '' : text(e, c.id)}
            placeholder={f?.from ? f.value : ''}
            onBlur={(ev) => commit(e, c.id, ev.target.value)}
            onKeyDown={(ev) => {
              if (ev.key === 'Enter') (ev.target as HTMLInputElement).blur()
              if (ev.key === 'Escape') setEditing(null)
            }}
          />
        </td>
      )
    // Sem as marcas de "a partir de…" (os segredos e revelações ficam na ficha).
    const value = g?.shown ?? ''
    return (
      <td key={c.id} className={c.id === 'cenas' || c.id === 'idade' ? 'is-num' : undefined}>
        {c.editable && !readOnly ? (
          <button type="button" className="table-cell" aria-label={`${c.label} de ${e.name}: ${value || 'vazio'}`} onClick={() => setEditing({ id: e.id, col: c.id })}>
            {value || <span className="muted">—</span>}
            {f?.from && <span className="table-from">{f.from}</span>}
          </button>
        ) : (
          value
        )}
      </td>
    )
  }

  return (
    <div className="entity-table-wrap">
      <div className="entity-table-tools">
        <span className="muted small">
          {rows.length} {rows.length === 1 ? 'ficha' : 'fichas'} · um toque na célula edita ali mesmo
        </span>
        <MoreMenu
          label="Colunas da tabela"
          buttonClass="btn btn-ghost btn-sm"
          button={
            <>
              <Columns3 size={14} aria-hidden="true" /> Colunas
            </>
          }
        >
          {() => (
            <div className="table-columns" role="group" aria-label="Colunas">
              {all.map((c) => (
                <label key={c.id} className="check">
                  <input type="checkbox" checked={visible.some((v) => v.id === c.id)} onChange={(ev) => choose(ev.target.checked ? [...visible.map((v) => v.id), c.id] : visible.filter((v) => v.id !== c.id).map((v) => v.id))} />
                  {c.label}
                </label>
              ))}
            </div>
          )}
        </MoreMenu>
      </div>
      <div className="table-wrap">
        <table className="entity-table">
          <thead>
            <tr>
              {header('nome', 'Nome')}
              {visible.map((c) => header(c.id, c.label))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((e) => (
              <tr key={e.id}>
                <th scope="row">
                  {editing?.id === e.id && editing.col === 'nome' ? (
                    <input
                      className="input input-sm"
                      autoFocus
                      aria-label={`Nome de ${e.name}`}
                      defaultValue={e.name}
                      onBlur={(ev) => commit(e, 'nome', ev.target.value)}
                      onKeyDown={(ev) => ev.key === 'Enter' && (ev.target as HTMLInputElement).blur()}
                    />
                  ) : (
                    <div className="table-name-cell">
                      <button type="button" className="link-btn table-name" onClick={() => onOpen(e.id)} onDoubleClick={() => !readOnly && setEditing({ id: e.id, col: 'nome' })}>
                        {e.name || 'Sem nome'}
                      </button>
                      {/* No dedo não há duplo clique: um lápis ao lado do nome (só em tela de toque). */}
                      {!readOnly && (
                        <button type="button" className="table-rename" aria-label={`Renomear ${e.name || 'ficha'}`} onClick={() => setEditing({ id: e.id, col: 'nome' })}>
                          <Pencil size={13} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  )}
                </th>
                {visible.map((c) => cell(e, c))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
