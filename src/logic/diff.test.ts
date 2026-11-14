import { describe, expect, it } from 'vitest'
import { addScene, byId, createUniverse, restoreSceneVersion, saveSceneVersion, updateScene } from '../model/universe'
import { compareSceneVersions, diffStats, diffWords, splitDiff } from './diff'

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

describe('comparar duas versões da cena', () => {
  /** A cena teve três textos: "Era noite.", "Era madrugada.", "Era madrugada fria." */
  function sceneWithVersions() {
    let [u, scene] = addScene(createUniverse(), null)
    u = updateScene(u, scene.id, { text: 'Era noite.' })
    u = saveSceneVersion(u, scene.id, 'v1')
    u = updateScene(u, scene.id, { text: 'Era madrugada.' })
    u = saveSceneVersion(u, scene.id, 'v2')
    u = updateScene(u, scene.id, { text: 'Era madrugada fria.' })
    const s = byId(u, 'scenes', scene.id)!
    const [v2, v1] = s.versions
    return { s, v1, v2 }
  }

  it('compara uma versão com o texto atual', () => {
    const { s, v1 } = sceneWithVersions()
    const c = compareSceneVersions(s, v1.id, 'atual')!
    expect(c.fromName).toBe('v1')
    expect(c.toName).toBe('texto atual')
    expect(c.stats).toEqual({ inserted: 2, removed: 1 })
  })

  it('compara duas versões entre si, na ordem escolhida', () => {
    const { s, v1, v2 } = sceneWithVersions()
    const subindo = compareSceneVersions(s, v1.id, v2.id)!
    expect(subindo.parts.filter((p) => p.kind === 'removido').map((p) => p.text)).toEqual(['noite.'])
    expect(subindo.parts.filter((p) => p.kind === 'inserido').map((p) => p.text)).toEqual(['madrugada.'])
    // Do outro lado: o que entrou e o que saiu se invertem.
    const descendo = compareSceneVersions(s, v2.id, v1.id)!
    expect(descendo.parts.filter((p) => p.kind === 'removido').map((p) => p.text)).toEqual(['madrugada.'])
    expect(descendo.stats).toEqual({ inserted: 1, removed: 1 })
  })

  it('versão que não existe não compara', () => {
    const { s, v1 } = sceneWithVersions()
    expect(compareSceneVersions(s, 'nada', 'atual')).toBeNull()
    expect(compareSceneVersions(s, v1.id, 'nada')).toBeNull()
  })

  it('separa o antes (com o que saiu) e o depois (com o que entrou) e cada lado reconstrói o seu texto', () => {
    const before = 'Kael viu o estranho.\n\nMira não viu nada.'
    const after = 'Kael viu o estranho de longe.\n\nMira viu tudo.'
    const { before: lado1, after: lado2 } = splitDiff(diffWords(before, after))
    expect(lado1.map((p) => p.text).join('')).toBe(before)
    expect(lado2.map((p) => p.text).join('')).toBe(after)
    expect(lado1.some((p) => p.kind === 'inserido')).toBe(false)
    expect(lado2.some((p) => p.kind === 'removido')).toBe(false)
  })
})
