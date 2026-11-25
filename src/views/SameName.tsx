import { fold } from '../logic/text'
import { kindLabel } from '../model/labels'
import type { Entity } from '../model/schema'
import { namesOf } from '../model/universe'

/** Fichas que já têm este nome (ou apelido): para avisar antes de criar uma ficha repetida. */
export function sameName(entities: Entity[], name: string): Entity[] {
  const n = fold(name.trim())
  if (n.length < 2) return []
  return entities.filter((e) => namesOf(e).some((x) => fold(x) === n))
}

/**
 * "Já existe Kael (Personagem). Abrir essa?" — logo abaixo do nome, enquanto se digita. Não impede criar:
 * dois personagens com o mesmo nome podem existir de propósito.
 */
export function SameNameHint({ entities, name, onOpen }: { entities: Entity[]; name: string; onOpen: (id: string) => void }) {
  const found = sameName(entities, name)
  if (!found.length) return null
  const first = found[0]
  const alias = fold(first.name) !== fold(name.trim())
  return (
    <p className="notice small same-name" role="status">
      Já existe <strong>{first.name}</strong> ({kindLabel(first.kind).toLocaleLowerCase('pt-BR')}{alias ? `, com “${name.trim()}” como outro nome` : ''}){found.length > 1 ? ` e mais ${found.length - 1}` : ''}.{' '}
      <button type="button" className="link-btn" onClick={() => onOpen(first.id)}>
        Abrir essa
      </button>{' '}
      ou crie outra mesmo assim.
    </p>
  )
}
