import { fold } from '../logic/text'
import { addMembers, listsOf, membershipsOf } from './lists'
import type { Entity, Universe } from './schema'
import { byId, draftEntity, insert, newId } from './universe'

export type EntityTemplate = NonNullable<Universe['settings']['entityTemplates']>[number]

export const templatesOf = (u: Universe): EntityTemplate[] => u.settings.entityTemplates ?? []

const withTemplates = (u: Universe, list: EntityTemplate[]): Universe => ({ ...u, settings: { ...u.settings, entityTemplates: list }, updatedAt: new Date().toISOString() })

/**
 * "Usar como modelo": guarda o jeito desta ficha (tipo, campos, etiquetas, resumo, descrição e as
 * listas em que está) com um nome. Um modelo com o mesmo nome é trocado.
 */
export function saveAsTemplate(u: Universe, e: Entity, name = e.name): [Universe, EntityTemplate] {
  const t: EntityTemplate = {
    id: newId(),
    name: name.trim() || 'Modelo',
    kind: e.kind,
    summary: e.summary,
    description: e.description,
    tags: [...e.tags],
    fields: e.fields.map((f) => ({ ...f })),
    memberships: membershipsOf(u, e.id).map((m) => ({ ownerId: m.owner.id, listId: m.list.id, ...(m.relation.role ? { role: m.relation.role } : {}) })),
  }
  const others = templatesOf(u).filter((x) => fold(x.name) !== fold(t.name))
  return [withTemplates(u, [...others, t]), t]
}

export const removeTemplate = (u: Universe, id: string): Universe =>
  withTemplates(
    u,
    templatesOf(u).filter((t) => t.id !== id),
  )

export const renameTemplate = (u: Universe, id: string, name: string): Universe =>
  withTemplates(
    u,
    templatesOf(u).map((t) => (t.id === id ? { ...t, name } : t)),
  )

/** Uma ficha nova a partir do modelo: campos, etiquetas, resumo e as listas dele; o nome é o dado. */
export function createFromTemplate(u: Universe, t: EntityTemplate, name: string): [Universe, Entity] {
  const draft = draftEntity(t.kind, name)
  const [withEntity, e] = insert(u, 'entities', { ...draft, summary: t.summary, description: t.description, tags: [...t.tags], fields: t.fields.map((f) => ({ ...f })) })
  let next = withEntity
  for (const m of t.memberships) {
    const owner = byId(next, 'entities', m.ownerId)
    if (owner && listsOf(owner).some((l) => l.id === m.listId)) next = addMembers(next, m.ownerId, m.listId, [e.id], { role: m.role })
  }
  return [next, byId(next, 'entities', e.id) ?? e]
}
