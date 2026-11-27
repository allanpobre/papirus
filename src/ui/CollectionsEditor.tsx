import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { collectionTree } from '../model/universe'
import { newId, now } from '../model/universe'
import { useWorkspace } from '../state/workspace'
import { Modal } from './Modal'

/**
 * Organizar as coleções de livros do universo ("Tales of Papilio" com "Tales of Malkai" dentro): nome, em qual
 * coleção cada uma está, e a coleção de cada livro (uma casa só). Escolher a coleção no alto junta os livros dela.
 */
export function CollectionsEditor({ onClose }: { onClose: () => void }) {
  const { universe, update, readOnly } = useWorkspace()
  const [name, setName] = useState('')
  const cols = universe.collections
  const add = () => {
    const n = name.trim()
    if (!n) return
    update((u) => ({ ...u, collections: [...u.collections, { id: newId(), name: n }] }))
    setName('')
  }
  const rename = (id: string, value: string) => update((u) => ({ ...u, collections: u.collections.map((c) => (c.id === id ? { ...c, name: value } : c)) }))
  const setParent = (id: string, parentId: string) => update((u) => ({ ...u, collections: u.collections.map((c) => (c.id === id ? { ...c, parentId: parentId || undefined } : c)) }))
  // Apagar a coleção: as de dentro sobem um nível e os livros ficam soltos (nada some).
  const remove = (id: string) =>
    update((u) => {
      const parent = u.collections.find((c) => c.id === id)?.parentId
      return {
        ...u,
        collections: u.collections.filter((c) => c.id !== id).map((c) => (c.parentId === id ? { ...c, parentId: parent } : c)),
        stories: u.stories.map((s) => (s.collectionId === id ? { ...s, collectionId: undefined, updatedAt: now() } : s)),
      }
    })
  const place = (storyId: string, collectionId: string) => update((u) => ({ ...u, stories: u.stories.map((s) => (s.id === storyId ? { ...s, collectionId: collectionId || undefined, updatedAt: now() } : s)) }))

  return (
    <Modal title="Coleções de livros" about="Agrupe os livros do universo em coleções, uma dentro da outra se quiser (o “Tales of Malkai” dentro do “Tales of Papilio”). Cada livro fica em uma coleção só; as fichas continuam sendo de todos." size="md" onClose={onClose}>
      <div className="collections-editor">
        {cols.length === 0 && <p className="muted small">Nenhuma coleção ainda. Crie a primeira abaixo.</p>}
        <ul className="collections-list">
          {cols.map((c) => {
            const blocked = collectionTree(universe, c.id)
            return (
              <li key={c.id}>
                <input className="input" aria-label={`Nome da coleção ${c.name}`} value={c.name} disabled={readOnly} onChange={(e) => rename(c.id, e.target.value)} />
                <select className="input select" aria-label={`Dentro de (${c.name})`} value={c.parentId ?? ''} disabled={readOnly} onChange={(e) => setParent(c.id, e.target.value)}>
                  <option value="">Solta (primeiro nível)</option>
                  {cols.filter((o) => !blocked.includes(o.id)).map((o) => (
                    <option key={o.id} value={o.id}>
                      Dentro de {o.name || 'Sem nome'}
                    </option>
                  ))}
                </select>
                {!readOnly && (
                  <button type="button" className="btn-icon" aria-label={`Apagar a coleção ${c.name}`} title="Apaga só a coleção: os livros ficam soltos" onClick={() => remove(c.id)}>
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
        {!readOnly && (
          <form
            className="collections-add"
            onSubmit={(e) => {
              e.preventDefault()
              add()
            }}
          >
            <input className="input" aria-label="Nome da nova coleção" placeholder="Nova coleção (ex.: Tales of Papilio)" value={name} onChange={(e) => setName(e.target.value)} />
            <button type="submit" className="btn btn-primary btn-sm">
              <Plus size={15} aria-hidden="true" /> Criar
            </button>
          </form>
        )}
        <h3 className="shield-label">Em qual coleção está cada livro</h3>
        <ul className="collections-list">
          {universe.stories.map((s) => (
            <li key={s.id}>
              <span className="collections-book">{s.title || 'Sem título'}</span>
              <select className="input select" aria-label={`Coleção de ${s.title || 'Sem título'}`} value={cols.some((c) => c.id === s.collectionId) ? s.collectionId : ''} disabled={readOnly} onChange={(e) => place(s.id, e.target.value)}>
                <option value="">Solto (sem coleção)</option>
                {cols.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name || 'Sem nome'}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  )
}
