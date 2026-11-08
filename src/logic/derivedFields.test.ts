import { describe, expect, it } from 'vitest'
import { addList, addMembers } from '../model/lists'
import type { Universe } from '../model/schema'
import { byId, createUniverse, draftEntity, draftRelation, insert } from '../model/universe'
import { derivedField, linkKey } from './derivedFields'

function world() {
  let u: Universe = createUniverse('T')
  const make = (kind: string, name: string) => {
    const [next, e] = insert(u, 'entities', draftEntity(kind, name))
    u = next
    return e.id
  }
  const nova = make('faccao', 'Nova Gyudenvän')
  const malkai = make('personagem', 'Malkai')
  const gavinhas = make('personagem', 'Gavinhas')
  const guarda = make('faccao', 'Guarda do Porto')
  const porto = make('lugar', 'Porto')
  const relate = (from: string, to: string, type: string) => {
    u = insert(u, 'relations', draftRelation(from, to, type))[0]
  }
  return {
    get u() {
      return u
    },
    set u(v) {
      u = v
    },
    nova,
    malkai,
    gavinhas,
    guarda,
    porto,
    relate,
  }
}

describe('campos que as ligações respondem', () => {
  it('o nome do campo e o da ligação viram o mesmo miolo', () => {
    expect(linkKey('Líder')).toBe(linkKey('líder de'))
    expect(linkKey('Inimigos')).toBe(linkKey('inimigo de'))
    expect(linkKey('Quem governa')).toBe(linkKey('governa'))
    expect(linkKey('Governante')).toBe(linkKey('governa'))
    expect(linkKey('Líderes')).toBe('lider')
    expect(linkKey('Objetivo')).not.toBe(linkKey('líder de'))
  })

  it('"Malkai líder de Nova" preenche o Líder; inimigo vale dos dois lados; papel na lista também conta', () => {
    const w = world()
    w.relate(w.malkai, w.nova, 'líder de')
    w.relate(w.nova, w.guarda, 'inimigo de')
    w.relate(w.malkai, w.porto, 'governa')
    const nova = () => byId(w.u, 'entities', w.nova)!
    expect(derivedField(w.u, nova(), 'Líder')).toEqual([w.malkai])
    expect(derivedField(w.u, nova(), 'Inimigos')).toEqual([w.guarda])
    expect(derivedField(w.u, byId(w.u, 'entities', w.guarda)!, 'Inimigos')).toEqual([w.nova])
    expect(derivedField(w.u, byId(w.u, 'entities', w.porto)!, 'Quem governa')).toEqual([w.malkai])
    // "líder de" não vale ao contrário: Malkai não tem Nova como líder.
    expect(derivedField(w.u, byId(w.u, 'entities', w.malkai)!, 'Líder')).toEqual([])
    expect(derivedField(w.u, nova(), 'Objetivo')).toEqual([])
    // O papel "líder" na lista de membros.
    let membros
    ;[w.u, membros] = addList(w.u, w.nova, 'Membros')
    w.u = addMembers(w.u, w.nova, membros.id, [w.gavinhas], { role: 'líder' })
    expect(derivedField(w.u, nova(), 'Líder')).toEqual([w.malkai, w.gavinhas])
  })
})
