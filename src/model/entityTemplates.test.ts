import { describe, expect, it } from 'vitest'
import { createFromTemplate, removeTemplate, saveAsTemplate, templatesOf } from './entityTemplates'
import { addList, addMembers, membershipsOf } from './lists'
import { byId, createUniverse, draftEntity, insert, patch } from './universe'

describe('modelos de ficha', () => {
  it('guarda o jeito da ficha e cria outras iguais, já nas mesmas listas, com o nome novo', () => {
    let u = createUniverse('T')
    let cla, soldado
    ;[u, cla] = insert(u, 'entities', draftEntity('faccao', 'Clã do Corvo'))
    ;[u, soldado] = insert(u, 'entities', draftEntity('personagem', 'Soldado do Clã'))
    u = patch(u, 'entities', soldado.id, { tags: ['guarda'], fields: [{ key: 'Arma', value: 'lança' }] })
    let membros
    ;[u, membros] = addList(u, cla.id, 'Membros')
    u = addMembers(u, cla.id, membros.id, [soldado.id], { role: 'soldado' })
    let t
    ;[u, t] = saveAsTemplate(u, byId(u, 'entities', soldado.id)!)
    expect(templatesOf(u).map((x) => x.name)).toEqual(['Soldado do Clã'])
    // Salvar de novo com o mesmo nome troca, não duplica.
    ;[u] = saveAsTemplate(u, byId(u, 'entities', soldado.id)!)
    expect(templatesOf(u)).toHaveLength(1)
    t = templatesOf(u)[0]
    let doran
    ;[u, doran] = createFromTemplate(u, t, 'Doran')
    expect(doran).toMatchObject({ name: 'Doran', kind: 'personagem', tags: ['guarda'], fields: [{ key: 'Arma', value: 'lança' }] })
    expect(membershipsOf(u, doran.id).map((m) => `${m.owner.name} · ${m.list.name} · ${m.relation.role}`)).toEqual(['Clã do Corvo · Membros · soldado'])
    u = removeTemplate(u, t.id)
    expect(templatesOf(u)).toHaveLength(0)
  })
})
