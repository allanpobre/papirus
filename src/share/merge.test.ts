import { describe, expect, it } from 'vitest'
import { sampleUniverse } from '../model/sample'
import { addScene, createUniverse, patch, removeScene, updateScene } from '../model/universe'
import { mergeUniverse } from './merge'
import { readerCopy } from './readerCopy'

describe('mergeUniverse', () => {
  const [base, scene] = addScene(createUniverse('Ostria'), null, 'Cena 1')
  const [withTwo, second] = addScene(base, null, 'Cena 2')

  it('junta mudanças em registros diferentes', () => {
    const mine = updateScene(withTwo, scene.id, { synopsis: 'minha' })
    const doc = { type: 'doc' as const, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Kael chegou.' }] }] }
    const theirs = updateScene(withTwo, second.id, { synopsis: 'dele', doc })
    const r = mergeUniverse(withTwo, mine, theirs, 'Bia')
    expect(r.universe.scenes.map((s) => s.synopsis)).toEqual(['minha', 'dele'])
    expect(r.copies).toEqual([])
    expect(r.changedScenes).toEqual([second.id])
  })

  it('mexeram no mesmo registro: fica o meu e o outro vira cópia', () => {
    const mine = updateScene(withTwo, scene.id, { title: 'Minha' })
    const theirs = updateScene(withTwo, scene.id, { title: 'Dela' })
    const r = mergeUniverse(withTwo, mine, theirs, 'Bia')
    expect(r.universe.scenes.map((s) => s.title)).toEqual(['Minha', 'Dela (versão de Bia)', 'Cena 2'])
    expect(r.copies).toEqual(['Dela'])
  })

  it('apagado de um lado só some se o outro não mexeu', () => {
    const theirs = removeScene(withTwo, second.id)
    expect(mergeUniverse(withTwo, withTwo, theirs, 'Bia').universe.scenes).toHaveLength(1)
    const mine = updateScene(withTwo, second.id, { synopsis: 'mexi' })
    expect(mergeUniverse(withTwo, mine, theirs, 'Bia').universe.scenes).toHaveLength(2)
    expect(mergeUniverse(withTwo, theirs, mine, 'Bia').universe.scenes).toHaveLength(2)
  })

  it('campos do universo: vale o lado que mudou', () => {
    const theirs = { ...withTwo, name: 'Ostria Nova' }
    const r = mergeUniverse(withTwo, withTwo, theirs, 'Bia')
    expect(r.universe.name).toBe('Ostria Nova')
    expect(mergeUniverse(withTwo, withTwo, withTwo, 'Bia').unchanged).toBe(true)
  })

  it('registros novos dos dois lados entram', () => {
    const [mine] = addScene(withTwo, null, 'Minha nova')
    const [theirs] = addScene(withTwo, null, 'Nova dela')
    expect(mergeUniverse(withTwo, mine, theirs, 'Bia').universe.scenes.map((s) => s.title)).toEqual(['Cena 1', 'Cena 2', 'Minha nova', 'Nova dela'])
  })
})

describe('readerCopy', () => {
  const u = sampleUniverse()
  it('sem segredos: tira fichas secretas, o que liga a elas e os trechos [segredo]', () => {
    const secret = u.entities.filter((e) => e.canon === 'secreto')
    expect(secret.length).toBeGreaterThan(0)
    const r = readerCopy(u, false)
    const ids = new Set(secret.map((e) => e.id))
    expect(r.entities.some((e) => ids.has(e.id))).toBe(false)
    expect(r.relations.some((x) => ids.has(x.fromId) || ids.has(x.toId) || x.via.some((v) => ids.has(v.entityId)))).toBe(false)
    expect(JSON.stringify(r)).not.toMatch(/\[segredo\]/i)
    expect(r.inbox).toEqual([])
  })

  it('com segredos: mantém tudo, menos a Inbox e as chaves do Codex', () => {
    const shared = patch(u, 'groups', u.groups[0].id, { share: { id: crypto.randomUUID(), key: 'chave' } })
    const r = readerCopy(shared, true)
    expect(r.entities).toHaveLength(u.entities.length)
    expect(r.groups.every((g) => g.share === null)).toBe(true)
  })
})
