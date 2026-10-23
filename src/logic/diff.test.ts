import { describe, expect, it } from 'vitest'
import { addScene, byId, createUniverse, restoreSceneVersion, saveSceneVersion, updateScene } from '../model/universe'
import { diffStats, diffWords } from './diff'

describe('diffWords', () => {
  it('mostra o que entrou e o que saiu, palavra a palavra', () => {
    const parts = diffWords('Era noite em Ostria.', 'Era madrugada em Ostria.')
    expect(parts).toEqual([
      { kind: 'igual', text: 'Era ' },
      { kind: 'removido', text: 'noite' },
      { kind: 'inserido', text: 'madrugada' },
      { kind: 'igual', text: ' em Ostria.' },
    ])
    expect(diffStats(parts)).toEqual({ inserted: 1, removed: 1 })
  })

  it('reconstrói os dois textos a partir da diferença', () => {
    const before = 'Kael viu o estranho.\n\nMira não viu nada.'
    const after = 'Kael viu o estranho de longe.\n\nMira viu tudo.'
    const parts = diffWords(before, after)
    expect(parts.filter((p) => p.kind !== 'inserido').map((p) => p.text).join('')).toBe(before)
    expect(parts.filter((p) => p.kind !== 'removido').map((p) => p.text).join('')).toBe(after)
  })

  it('textos iguais não têm diferença', () => {
    expect(diffWords('igual', 'igual')).toEqual([{ kind: 'igual', text: 'igual' }])
    expect(diffWords('', '')).toEqual([])
  })
})

describe('versões de cena', () => {
  it('guarda e restaura, preservando o texto atual como nova versão', () => {
    let [u, scene] = addScene(createUniverse(), null)
    u = updateScene(u, scene.id, { text: 'Primeira' })
    u = saveSceneVersion(u, scene.id, 'v1')
    u = updateScene(u, scene.id, { text: 'Segunda' })
    const v1 = byId(u, 'scenes', scene.id)!.versions[0]
    u = restoreSceneVersion(u, scene.id, v1.id)
    const after = byId(u, 'scenes', scene.id)!
    expect(after.text).toBe('Primeira')
    expect(after.versions.map((v) => [v.name, v.text])).toEqual([
      ['Antes de voltar para “v1”', 'Segunda'],
      ['v1', 'Primeira'],
    ])
  })
})
