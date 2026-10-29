import { describe, expect, it } from 'vitest'
import type { Universe } from '../model/schema'
import { addScene, addStory, createUniverse, draftEntity, draftSeed, insert, patch, updateScene } from '../model/universe'
import { mapNotices, promiseLines, storyMap, withoutCard } from './map'

const words = (n: number) => Array.from({ length: n }, () => 'palavra').join(' ')

/** Uma história com cenas de tamanhos dados (em palavras). */
function book(sizes: number[]) {
  let u: Universe = createUniverse('Ostria')
  let story
  ;[u, story] = addStory(u, 'Livro I')
  const ids: string[] = []
  sizes.forEach((n, i) => {
    let s
    ;[u, s] = addScene(u, story.id, `Cena ${i + 1}`)
    u = updateScene(u, s.id, { text: words(n) })
    ids.push(s.id)
  })
  return { u, story, ids }
}

describe('o Mapa', () => {
  it('posiciona as cenas pelas palavras e diz em que ato e em que momento cada uma cai', () => {
    const { u, story } = book([100, 100, 200, 100])
    const map = storyMap(u, story.id, 'tres-atos')
    expect(map.map((m) => [m.from, m.to])).toEqual([
      [0, 0.2],
      [0.2, 0.4],
      [0.4, 0.8],
      [0.8, 1],
    ])
    expect(map.map((m) => m.act)).toEqual([0, 0, 1, 2])
    expect(map[2].beats).toEqual(['Meio', 'Tudo perdido'])
    expect(storyMap(u, story.id, 'livre').every((m) => m.act === -1 && m.beats.length === 0)).toBe(true)
  })

  it('sem palavras ainda, conta as cenas', () => {
    const { u, story } = book([0, 0, 0, 0])
    expect(storyMap(u, story.id, 'tres-atos').map((m) => m.from)).toEqual([0, 0.25, 0.5, 0.75])
  })

  it('as promessas viram linhas, e uma plantada sem nada depois, já para trás, conta como parada', () => {
    let { u, story, ids } = book([100, 100, 100, 100])
    let a, b
    ;[u, a] = insert(u, 'seeds', { ...draftSeed('A espada embrulhada'), setupSceneId: ids[0], payoffSceneId: ids[3], status: 'resolvida' })
    ;[u, b] = insert(u, 'seeds', { ...draftSeed('Os 312 degraus'), setupSceneId: ids[0] })
    const map = storyMap(u, story.id, 'tres-atos')
    const lines = promiseLines(u, map)
    expect(lines.find((l) => l.seed.id === a.id)).toMatchObject({ stalled: false })
    expect(lines.find((l) => l.seed.id === a.id)!.points.map((p) => p.kind)).toEqual(['plantada', 'paga'])
    expect(lines.find((l) => l.seed.id === b.id)).toMatchObject({ stalled: true })
    u = patch(u, 'seeds', b.id, { clues: [{ id: 'p1', text: 'Mira conta os degraus', sceneId: ids[2] }] })
    expect(promiseLines(u, map).find((l) => l.seed.id === b.id)).toMatchObject({ stalled: false })
  })

  it('os avisos são perguntas sobre o que o autor marcou e o que dá para contar', () => {
    let { u, story, ids } = book([100, 100, 100, 100, 100, 100])
    for (const id of ids.slice(0, 4)) u = updateScene(u, id, { shift: 'pior' })
    u = updateScene(u, ids[4], { shift: 'igual' })
    let mira
    ;[u, mira] = insert(u, 'entities', draftEntity('personagem', 'Mira'))
    u = updateScene(u, ids[0], { povId: mira.id })
    const map = storyMap(u, story.id, 'tres-atos')
    const notes = mapNotices(u, map, 'tres-atos', promiseLines(u, map)).map((n) => n.text)
    expect(notes).toContain('Quatro cenas seguidas terminam pior (de “Cena 1” a “Cena 4”). É de propósito?')
    expect(notes).toContain('“Cena 5” está marcada como “igual”. Alguma coisa muda nela?')
    expect(notes).toContain('Mira fica cinco cenas sem aparecer depois de “Cena 1”. O leitor ainda lembra?')
    // O meio (50%) cai no começo da cena 4, marcada como "pior": é uma virada, então não pergunta.
    expect(notes.some((n) => n.startsWith('O meio da história'))).toBe(false)
    u = updateScene(u, ids[3], { shift: '' })
    const again = mapNotices(u, storyMap(u, story.id, 'tres-atos'), 'tres-atos', []).map((n) => n.text)
    expect(again[0]).toBe('O meio da história cai em “Cena 4”, que ainda não tem marca. Ela é uma virada?')
    expect(withoutCard(map)).toHaveLength(6)
  })
})
