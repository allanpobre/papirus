import { BookMarked, CalendarRange, Dices, Feather, Lightbulb, Plus, Sprout, BookOpen, Search } from 'lucide-react'
import { useBackLayer } from '../ui/useBackLayer'
import { useMemo, useState } from 'react'
import { commands, matchCommands } from './commands'
import { searchUniverse, type SearchKind, type SearchResult } from '../logic/search'
import { byId, draftEntity, insert } from '../model/universe'
import { useWorkspace, type View } from '../state/workspace'

const ICON: Record<SearchKind, typeof Feather> = {
  ficha: BookMarked,
  cena: Feather,
  historia: BookOpen,
  evento: CalendarRange,
  fato: Lightbulb,
  semente: Sprout,
  sessao: Dices,
}

const KIND_LABEL: Record<SearchKind, string> = {
  ficha: 'Ficha',
  cena: 'Cena',
  historia: 'História',
  evento: 'Evento',
  fato: 'Fato',
  semente: 'Trama',
  sessao: 'Sessão',
}

/** Busca em todo o universo (Ctrl/⌘+K). Enter abre; sem resultado, oferece criar ficha. */
export function SearchPalette({ onClose }: { onClose: () => void }) {
  const ws = useWorkspace()
  useBackLayer(onClose)
  const { universe, go, update, peek } = ws
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const actions = useMemo(() => matchCommands(commands(ws), query).slice(0, 6), [ws, query])
  const results = useMemo(() => searchUniverse(universe, query, 20), [universe, query])
  const canCreate = query.trim().length > 0 && !ws.readOnly
  const total = actions.length + results.length + (canCreate ? 1 : 0)
  // Índices: primeiro as ações, depois os resultados, por fim "Criar ficha".
  const resultAt = (i: number) => results[i - actions.length]

  const open = (r: SearchResult) => {
    onClose()
    const target: Record<SearchKind, View> = {
      ficha: 'fichas',
      cena: 'escrever',
      historia: 'escrever',
      evento: 'timeline',
      fato: 'conhecimento',
      semente: 'tramas',
      sessao: 'rpg',
    }
    if (r.kind === 'historia') {
      const first = universe.scenes.filter((s) => s.storyId === r.id).sort((a, b) => a.order - b.order)[0]
      go('escrever', first?.id ?? null)
      return
    }
    if (r.kind === 'fato') {
      const f = byId(universe, 'facts', r.id)
      if (f?.subjectId) return go('fichas', f.subjectId)
    }
    go(target[r.kind], r.id)
  }

  const create = () => {
    const name = query.trim()
    let id = ''
    update((u) => {
      const [next, e] = insert(u, 'entities', draftEntity('personagem', name))
      id = e.id
      return next
    })
    onClose()
    go('fichas', id)
  }

  return (
    <div className="overlay overlay-top" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Buscar">
        <div className="palette-input">
          <Search size={18} aria-hidden="true" />
          <input
            autoFocus
            aria-label="Buscar no universo"
            role="combobox"
            aria-expanded={total > 0}
            aria-controls="palette-results"
            aria-activedescendant={total ? `palette-${active}` : undefined}
            placeholder="Buscar ou fazer: fichas, cenas, “nova cena”, “tema”…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose()
              else if (e.key === 'ArrowDown') {
                e.preventDefault()
                setActive((a) => Math.min(a + 1, total - 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActive((a) => Math.max(a - 1, 0))
              } else if (e.key === 'Enter' && total) {
                e.preventDefault()
                if (active < actions.length) {
                  onClose()
                  actions[active].run(ws)
                } else if (active < actions.length + results.length) {
                  const r = resultAt(active)
                  if (e.shiftKey && r.kind === 'ficha') {
                    onClose()
                    peek(r.id)
                  } else open(r)
                } else create()
              }
            }}
          />
        </div>
        <ul id="palette-results" role="listbox" className="palette-results">
          {actions.map((c, i) => {
            const Icon = c.icon
            return (
              <li
                key={c.id}
                id={`palette-${i}`}
                role="option"
                aria-selected={i === active}
                className={`palette-action${i === active ? ' active' : ''}`}
                onMouseMove={(e) => (e.movementX || e.movementY) && active !== i && setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault()
                  onClose()
                  c.run(ws)
                }}
              >
                <Icon size={16} aria-hidden="true" />
                <span className="palette-title">{c.title}</span>
                <span className="palette-kind">Ação</span>
              </li>
            )
          })}
          {results.map((r, j) => {
            const i = j + actions.length
            const Icon = ICON[r.kind]
            return (
              <li
                key={`${r.kind}-${r.id}`}
                id={`palette-${i}`}
                role="option"
                aria-selected={i === active}
                className={i === active ? 'active' : undefined}
                onMouseMove={(e) => (e.movementX || e.movementY) && active !== i && setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault()
                  open(r)
                }}
              >
                <Icon size={16} aria-hidden="true" />
                <span className="palette-title">{r.title}</span>
                <span className="palette-detail">{r.detail}</span>
                <span className="palette-kind">{KIND_LABEL[r.kind]}</span>
              </li>
            )
          })}
          {canCreate && (
            <li
              id={`palette-${total - 1}`}
              role="option"
              aria-selected={active === total - 1}
              className={active === total - 1 ? 'active' : undefined}
              onMouseMove={(e) => (e.movementX || e.movementY) && active !== total - 1 && setActive(total - 1)}
              onMouseDown={(e) => {
                e.preventDefault()
                create()
              }}
            >
              <Plus size={16} aria-hidden="true" />
              <span className="palette-title">Criar ficha “{query.trim()}”</span>
            </li>
          )}
          {!query && <li className="palette-hint">Digite para buscar no universo ou achar uma ação (“nova cena”, “tema”, “lixeira”…). Enter abre; Shift+Enter espia uma ficha.</li>}
        </ul>
      </div>
    </div>
  )
}
