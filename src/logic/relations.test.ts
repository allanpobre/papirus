import { describe, expect, it } from 'vitest'
import { ostriaUniverse as sampleUniverse } from '../model/sampleOstria'
import { draftRelation, insert, manuscriptOrder, removeEntity } from '../model/universe'
import { activeAt, involvements, relationSentence, scopeLabel } from './relations'

const u = sampleUniverse()
const find = (name: string) => u.entities.find((e) => e.name === name)!

describe('relações indiretas e com tempo', () => {
  it('escreve quem está por trás', () => {
    const [v, r] = insert(u, 'relations', { ...draftRelation(find('Kael').id, find('Vaelor').id, 'envenenou'), via: [{ entityId: find('Mira').id, role: 'a mando de' }] })
    expect(relationSentence(v, r)).toBe('Kael envenenou Vaelor, a mando de Mira')
    expect(involvements(v, find('Mira').id).map((x) => x.relation.id)).toContain(r.id)
    // Apagar quem estava por trás não apaga a relação; só tira a pessoa dela.
    const w = removeEntity(v, find('Mira').id)
    expect(w.relations.find((x) => x.id === r.id)?.via).toEqual([])
  })

  it('vale conforme o ponto da história', () => {
    const scenes = manuscriptOrder(u)
    const escondeu = u.relations.find((r) => r.type === 'escondeu')!
    const teme = u.relations.find((r) => r.type === 'teme')!
    const irmao = u.relations.find((r) => r.type === 'irmão de')!
    expect(scopeLabel(u, escondeu)).toBe('de 341 DC a 358 DC')
    expect(scopeLabel(u, teme)).toBe('em Livro I — A Maré Volta')
    expect(scopeLabel(u, irmao)).toBe('')
    // As cenas do Livro I se passam em 359: "escondeu" (até 358) já não vale; "teme" vale.
    const c1 = scenes[0]
    expect(activeAt(irmao, c1)).toBe(true)
    expect(activeAt(escondeu, c1)).toBe(false)
    expect(activeAt(teme, c1)).toBe(true)
    const solta = scenes.find((s) => s.storyId === null)!
    expect(activeAt(teme, solta)).toBe(false)
    expect(activeAt(teme, null)).toBe(true)
    const soCena = { ...irmao, scope: { kind: 'cenas' as const, fromYear: null, toYear: null, storyIds: [], sceneIds: [c1.id] } }
    expect(activeAt(soCena, c1)).toBe(true)
    expect(activeAt(soCena, scenes[1])).toBe(false)
    expect(scopeLabel(u, soCena)).toBe(`na cena “${c1.title}”`)
  })
})
