import { describe, expect, it } from 'vitest'
import { addList, addMembers, endMembership, inheritedConflicts, inheritedFields, membersOf, membershipsOf, migrateParents, removeList, updateList, addTagToMany, listTemplatesFor } from './lists'
import { byId, createUniverse, draftEntity, insert, patch } from './universe'
import type { Universe } from './schema'

function world() {
  let u: Universe = createUniverse('T')
  const make = (kind: string, name: string) => {
    const [next, e] = insert(u, 'entities', draftEntity(kind, name))
    u = next
    return e.id
  }
  const ostria = make('reino', 'Ostria')
  const vael = make('reino', 'Vael')
  const elfo = make('especie', 'Elfo')
  const floresta = make('especie', 'Elfo da floresta')
  const cla = make('faccao', 'Clã do Corvo')
  const mira = make('personagem', 'Mira')
  const kael = make('personagem', 'Kael')
  return {
    get u() {
      return u
    },
    set u(v) {
      u = v
    },
    ostria,
    vael,
    elfo,
    floresta,
    cla,
    mira,
    kael,
  }
}

describe('listas', () => {
  it('cria a lista, põe várias fichas de uma vez, com papel, e mostra dos dois lados', () => {
    const w = world()
    let [u, membros] = addList(w.u, w.cla, 'Membros')
    expect(membros.accepts).toEqual(['personagem'])
    u = addMembers(u, w.cla, membros.id, [w.mira, w.kael, w.mira], { role: 'líder' })
    expect(membersOf(u, w.cla, membros.id).map((m) => m.member.name)).toEqual(['Mira', 'Kael'])
    expect(membersOf(u, w.cla, membros.id)[0].relation.role).toBe('líder')
    expect(membershipsOf(u, w.kael).map((m) => `${m.owner.name} · ${m.list.name}`)).toEqual(['Clã do Corvo · Membros'])
    // Quem já está não entra de novo.
    u = addMembers(u, w.cla, membros.id, [w.kael])
    expect(membersOf(u, w.cla, membros.id)).toHaveLength(2)
    // Ex-membro vai para o fim e deixa de receber.
    const kaelRel = membersOf(u, w.cla, membros.id).find((m) => m.member.name === 'Kael')!.relation
    u = endMembership(u, kaelRel.id, 340)
    expect(membersOf(u, w.cla, membros.id).map((m) => m.member.name)).toEqual(['Mira', 'Kael'])
    // Tirar a lista desfaz as ligações dela, e as fichas ficam.
    u = removeList(u, w.cla, membros.id)
    expect(membershipsOf(u, w.mira)).toHaveLength(0)
    expect(byId(u, 'entities', w.mira)).toBeDefined()
  })

  it('o que todos têm passa adiante, inclusive de lista dentro de lista, e avisa quando duas listas discordam', () => {
    const w = world()
    let u = w.u
    let elfos, sub, hab, hab2
    ;[u, elfos] = addList(u, w.elfo, 'Quem é desta espécie')
    ;[u, sub] = addList(u, w.elfo, 'Subespécies')
    u = updateList(u, w.elfo, elfos.id, {
      shared: [
        { key: 'Vive', value: 'uns 700 anos' },
        { key: 'Enxerga', value: 'no escuro' },
      ],
    })
    u = updateList(u, w.elfo, sub.id, { shared: [{ key: 'Vive', value: 'uns 700 anos' }] })
    ;[u, hab] = addList(u, w.ostria, 'Habitantes')
    u = updateList(u, w.ostria, hab.id, { shared: [{ key: 'Idioma', value: 'ostriano' }] })
    ;[u, hab2] = addList(u, w.vael, 'Habitantes')
    u = updateList(u, w.vael, hab2.id, { shared: [{ key: 'Idioma', value: 'vaélico' }] })
    // Mira é Elfo e mora em Ostria.
    u = addMembers(u, w.elfo, elfos.id, [w.mira])
    u = addMembers(u, w.ostria, hab.id, [w.mira])
    expect(inheritedFields(u, w.mira).map((i) => `${i.key}: ${i.value} (${byId(u, 'entities', i.ownerId)?.name})`)).toEqual(['Vive: uns 700 anos (Elfo)', 'Enxerga: no escuro (Elfo)', 'Idioma: ostriano (Ostria)'])
    // Elfo da floresta está nas subespécies; quem é dele recebe também do Elfo, pelo caminho.
    let flor
    ;[u, flor] = addList(u, w.floresta, 'Quem é desta espécie')
    u = addMembers(u, w.elfo, sub.id, [w.floresta])
    u = addMembers(u, w.floresta, flor.id, [w.kael])
    const kael = inheritedFields(u, w.kael)
    expect(kael).toEqual([{ key: 'Vive', value: 'uns 700 anos', ownerId: w.elfo, listId: sub.id, via: [w.floresta] }])
    // Duas listas diretas com idiomas diferentes: avisa.
    u = addMembers(u, w.vael, hab2.id, [w.mira])
    expect(inheritedConflicts(u, w.mira)).toEqual([{ key: 'Idioma', owners: [w.ostria, w.vael] }])
  })

  it('"Fica dentro de" fica só para lugares; o resto vai para uma lista, sem perder nada', () => {
    const w = world()
    let u = patch(w.u, 'entities', w.kael, { parentId: w.cla })
    u = patch(u, 'entities', w.mira, { parentId: w.ostria })
    const [withCity, city] = insert(u, 'entities', { ...draftEntity('lugar', 'Porto'), parentId: w.ostria })
    u = migrateParents(withCity)
    expect(byId(u, 'entities', w.kael)?.parentId).toBeNull()
    expect(membershipsOf(u, w.kael).map((m) => `${m.owner.name} · ${m.list.name}`)).toEqual(['Clã do Corvo · Membros'])
    expect(membershipsOf(u, w.mira).map((m) => `${m.owner.name} · ${m.list.name}`)).toEqual(['Ostria · Habitantes'])
    expect(byId(u, 'entities', city.id)?.parentId).toBe(w.ostria)
    // Sem nada para mudar, devolve o mesmo universo.
    expect(migrateParents(u)).toBe(u)
  })

  it('cada tipo sugere as suas listas, e a seleção põe etiqueta em várias', () => {
    const w = world()
    expect(listTemplatesFor(w.u, 'reino')).toEqual(['Raças', 'Criaturas', 'Habitantes'])
    expect(listTemplatesFor({ ...w.u, settings: { ...w.u.settings, listTemplates: { reino: ['Províncias'] } } }, 'reino')).toEqual(['Províncias'])
    const u = addTagToMany(w.u, [w.mira, w.kael], 'porto')
    expect(byId(u, 'entities', w.kael)?.tags).toEqual(['porto'])
    expect(addTagToMany(u, [w.kael], 'Porto')).toEqual(u)
  })
})
