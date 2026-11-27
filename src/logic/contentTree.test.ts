import { describe, expect, it } from 'vitest'
import { addList, addMembers } from '../model/lists'
import { createUniverse, draftEntity, insert } from '../model/universe'
import type { Universe } from '../model/schema'
import { addBranch, contentTree, hasBranches, isBelow, moveBranch, treeSize } from './contentTree'

function mundo() {
  let u: Universe = createUniverse('W')
  const add = (kind: string, name: string, extra: object = {}) => {
    const [n, e] = insert(u, 'entities', { ...draftEntity(kind, name), ...extra })
    u = n
    return e
  }
  return { get u() { return u }, set u(v: Universe) { u = v }, add }
}

describe('árvore de uma ficha', () => {
  it('sai das listas (espécies) e do "fica dentro de" (lugares), sem gente por padrão', () => {
    const m = mundo()
    const dragoes = m.add('especie', 'Dragões')
    const croma = m.add('especie', 'Cromáticos')
    const vermelho = m.add('especie', 'Vermelho')
    const alice = m.add('personagem', 'Alice')
    let list
    ;[m.u, list] = addList(m.u, dragoes.id, 'Subespécies', [])
    m.u = addMembers(m.u, dragoes.id, list.id, [croma.id, alice.id])
    ;[m.u, list] = addList(m.u, croma.id, 'Subespécies', [])
    m.u = addMembers(m.u, croma.id, list.id, [vermelho.id])
    const t = contentTree(m.u, dragoes.id)!
    expect(t.children.map((c) => c.entity.name)).toEqual(['Cromáticos'])
    expect(t.children[0].children.map((c) => c.entity.name)).toEqual(['Vermelho'])
    expect(treeSize(t)).toBe(2)
    expect(contentTree(m.u, dragoes.id, { everyone: true })!.children.map((c) => c.entity.name)).toEqual(['Alice', 'Cromáticos'])
    const reino = m.add('reino', 'Valmar')
    m.add('lugar', 'Vila', { parentId: reino.id })
    expect(contentTree(m.u, reino.id)!.children.map((c) => c.entity.name)).toEqual(['Vila'])
    expect(hasBranches(m.u, vermelho.id)).toBe(false)
  })

  it('"+" cria do mesmo tipo, preso no galho; mover e não deixar um galho entrar em si mesmo', () => {
    const m = mundo()
    const dragoes = m.add('especie', 'Dragões')
    let a, b
    ;[m.u, a] = addBranch(m.u, dragoes.id, 'Cromáticos')
    ;[m.u, b] = addBranch(m.u, dragoes.id, 'Metálicos')
    expect(a!.kind).toBe('especie')
    expect(contentTree(m.u, dragoes.id)!.children.map((c) => c.entity.name)).toEqual(['Cromáticos', 'Metálicos'])
    let t = contentTree(m.u, dragoes.id)!
    const via = t.children.find((c) => c.entity.id === b!.id)!.via
    m.u = moveBranch(m.u, b!.id, via, a!.id)
    t = contentTree(m.u, dragoes.id)!
    expect(t.children.map((c) => c.entity.name)).toEqual(['Cromáticos'])
    expect(t.children[0].children.map((c) => c.entity.name)).toEqual(['Metálicos'])
    // Cromáticos para dentro de Metálicos (que está debaixo dele) não vale.
    const viaA = t.children[0].via
    expect(isBelow(m.u, a!.id, b!.id)).toBe(true)
    expect(moveBranch(m.u, a!.id, viaA, b!.id)).toBe(m.u)
  })

  it('sem os segredos, o galho secreto some', () => {
    const m = mundo()
    const dragoes = m.add('especie', 'Dragões')
    const segredo = m.add('especie', 'Dragão Sombrio', { canon: 'secreto' })
    let list
    ;[m.u, list] = addList(m.u, dragoes.id, 'Subespécies', [])
    m.u = addMembers(m.u, dragoes.id, list.id, [segredo.id])
    expect(contentTree(m.u, dragoes.id)!.children).toHaveLength(1)
    expect(contentTree(m.u, dragoes.id, { hideSecrets: true })!.children).toHaveLength(0)
  })
})
