import { describe, expect, it } from 'vitest'
import { createUniverse, draftEntity, draftRelation, insert } from '../model/universe'
import { suggestLinks } from './suggestLinks'

function mundo() {
  let u = createUniverse('Teste')
  const add = (kind: string, name: string, description: string) => {
    const [n, e] = insert(u, 'entities', { ...draftEntity(kind, name), description })
    u = n
    return e
  }
  const kael = add('personagem', 'Kael', 'Irmão de Mira. Nasceu no Porto de Varn e serve à Casa Vaelor. Tem medo do mar.')
  const mira = add('personagem', 'Mira', 'Irmã de Kael. Feiticeira da maré.')
  const porto = add('lugar', 'Porto de Varn', 'Cidade de sal.')
  const casa = add('faccao', 'Casa Vaelor', 'A casa real. Governa Ostria.')
  const ostria = add('reino', 'Ostria', 'Reino costeiro.')
  return { u, kael, mira, porto, casa, ostria }
}

describe('suggestLinks', () => {
  it('acha parentesco, nascimento, serviço e governo escritos no texto', () => {
    const { u, kael, mira, porto, casa, ostria } = mundo()
    const s = suggestLinks(u).map((x) => [x.fromId, x.type, x.toId])
    expect(s).toContainEqual([kael.id, 'irmão de', mira.id])
    expect(s).toContainEqual([kael.id, 'nasceu em', porto.id])
    expect(s).toContainEqual([kael.id, 'serve a', casa.id])
    expect(s).toContainEqual([casa.id, 'governa', ostria.id])
  })
  it('não repete o par ao contrário (“irmã de Kael” já está no “irmão de Mira”)', () => {
    const { u, kael, mira } = mundo()
    const pares = suggestLinks(u).filter((x) => [x.fromId, x.toId].sort().join() === [kael.id, mira.id].sort().join())
    expect(pares).toHaveLength(1)
  })
  it('não propõe o que já é ligação, nem cita nome solto sem relação', () => {
    let { u, kael, mira } = mundo()
    ;[u] = insert(u, 'relations', draftRelation(mira.id, kael.id, 'irmã de'))
    const s = suggestLinks(u)
    expect(s.some((x) => [x.fromId, x.toId].includes(mira.id) && [x.fromId, x.toId].includes(kael.id))).toBe(false)
    // “Tem medo do mar” não vira nada: não há ficha “mar”, e “medo do” não é relação.
    expect(s.every((x) => x.type !== 'medo de')).toBe(true)
  })
  it('“Casa Vaelor” ganha de “Vaelor” (o nome mais comprido primeiro)', () => {
    let { u, kael } = mundo()
    ;[u] = insert(u, 'entities', draftEntity('personagem', 'Vaelor'))
    const s = suggestLinks(u).filter((x) => x.fromId === kael.id && x.type === 'serve a')
    expect(s).toHaveLength(1)
    expect(u.entities.find((e) => e.id === s[0].toId)?.name).toBe('Casa Vaelor')
  })
})
