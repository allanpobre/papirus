import { describe, expect, it } from 'vitest'
import { ostriaUniverse } from '../model/sampleOstria'
import { addScene, addStory, updateScene } from '../model/universe'
import { allowAU, auNews, canCreateAU, canonize, createAU, isLore, itemHash, originState, pullOriginal } from './au'

const owner = { id: 'dono', email: 'ana@exemplo.com' }

describe('universo alternativo (AU)', () => {
  it('nasce do mundo sem os segredos, com as histórias como lore', () => {
    const original = ostriaUniverse()
    const au = createAU(original, owner)
    expect(au.id).not.toBe(original.id)
    expect(au.name).toBe(`${original.name} (AU)`)
    expect(au.derivedFrom?.universeId).toBe(original.id)
    const secret = original.entities.find((e) => e.canon === 'secreto')
    if (secret) expect(au.entities.some((e) => e.id === secret.id)).toBe(false)
    expect(au.entities.length).toBeGreaterThan(0)
    expect(au.entities.every((e) => originState(au, e) === 'original')).toBe(true)
    expect(isLore(au, au.scenes[0].id)).toBe(true)
    expect(au.sessions).toEqual([])
    expect(au.settings.wiki).toBeUndefined()
  })

  it('a ficha mudada aparece como "Mudou no AU"; a criada, como nova', () => {
    const au = createAU(ostriaUniverse(), owner)
    const changed = { ...au.entities[0], summary: 'Outra versão.' }
    expect(originState(au, changed)).toBe('mudou')
    expect(originState(au, { ...changed, summary: au.entities[0].summary, updatedAt: 'outra data' } as typeof changed)).toBe('original')
    expect(originState(au, { id: 'novo' })).toBe('novo')
    expect(originState(ostriaUniverse(), au.entities[0])).toBeNull()
  })

  it('traz as novidades do original sem desfazer o que o AU mudou', () => {
    const original = ostriaUniverse()
    let au = createAU(original, owner)
    const [a, b] = au.entities
    au = { ...au, entities: au.entities.map((e) => (e.id === a.id ? { ...e, summary: 'Do jeito do AU.' } : e)) }
    const fresh = {
      ...original,
      entities: [
        ...original.entities.map((e) => (e.id === a.id ? { ...e, summary: 'O autor mudou.' } : e.id === b.id ? { ...e, summary: 'Também mudou.' } : e)),
        { ...original.entities[0], id: 'nova-do-autor', name: 'Nova', canon: 'estabelecido' as const },
      ],
      scenes: original.scenes.map((s, i) => (i === 0 ? { ...s, title: 'Título novo' } : s)),
    }
    const r = pullOriginal(au, fresh)
    expect(r.added).toBe(1)
    expect(r.kept).toBe(1)
    const mine = (id: string) => r.universe.entities.find((e) => e.id === id)!
    expect(mine(a.id).summary).toBe('Do jeito do AU.')
    expect(mine(b.id).summary).toBe('Também mudou.')
    expect(originState(r.universe, mine(b.id))).toBe('original')
    expect(originState(r.universe, mine('nova-do-autor'))).toBe('original')
    // A lore sempre acompanha.
    expect(r.universe.scenes[0].title).toBe('Título novo')
  })

  it('o autor canoniza o que nasceu no AU, e a ficha usada vai junto', () => {
    const original = ostriaUniverse()
    let au = createAU(original, owner)
    const nova = { ...au.entities[0], id: 'ficha-do-au', name: 'Irmã de Mira' }
    const lig = { ...au.relations[0], id: 'lig-do-au', fromId: nova.id, toId: au.entities[1].id, type: 'irmã de' }
    au = { ...au, entities: [...au.entities, nova], relations: [...au.relations, lig] }
    const news = auNews(au, original)
    expect(news.map((n) => n.label)).toEqual(expect.arrayContaining(['Irmã de Mira', `Irmã de Mira · irmã de · ${au.entities[1].name}`]))
    const { universe, extra } = canonize(original, au, ['lig-do-au'])
    expect(extra).toEqual(['ficha-do-au'])
    expect(universe.entities.some((e) => e.id === 'ficha-do-au')).toBe(true)
    expect(universe.relations.some((r) => r.id === 'lig-do-au')).toBe(true)
    // Já canonizado: some da lista.
    expect(auNews(au, universe)).toEqual([])
    // E, ao trazer as novidades, vira "do original" no AU.
    const back = pullOriginal(au, universe).universe
    expect(originState(back, back.entities.find((e) => e.id === 'ficha-do-au')!)).toBe('original')
  })

  it('só quem o autor autorizou pode criar um AU, e o e-mail não fica à vista', async () => {
    let u = ostriaUniverse()
    expect(await canCreateAU(u, 'bia@exemplo.com')).toBe(false)
    u = await allowAU(u, 'Bia@Exemplo.com', true)
    expect(await canCreateAU(u, 'bia@exemplo.com')).toBe(true)
    expect(JSON.stringify(u.settings.au)).not.toContain('bia')
    u = await allowAU(u, 'bia@exemplo.com', false)
    expect(u.settings.au).toBeUndefined()
  })

  it('o resumo ignora a ordem das chaves e as datas', () => {
    expect(itemHash({ a: 1, b: [1, 2], updatedAt: 'x' })).toBe(itemHash({ b: [1, 2], a: 1, updatedAt: 'y' }))
    expect(itemHash({ a: 1 })).not.toBe(itemHash({ a: 2 }))
  })

  /** Um AU com uma história nova de duas cenas (a segunda usa uma ficha que só existe no AU). */
  function auWithStory() {
    const original = ostriaUniverse()
    let au = createAU(original, owner)
    const selma = { ...au.entities[0], id: 'selma-do-au', name: 'Selma' }
    au = { ...au, entities: [...au.entities, selma] }
    let story: ReturnType<typeof addStory>[1]
    ;[au, story] = addStory(au, 'A Selma em Ostria')
    let c1: ReturnType<typeof addScene>[1]
    let c2: ReturnType<typeof addScene>[1]
    ;[au, c1] = addScene(au, story.id, 'Chegada da Selma')
    ;[au, c2] = addScene(au, story.id, 'O porto de manhã')
    au = updateScene(au, c1.id, { text: 'Selma desembarcou.' })
    au = updateScene(au, c2.id, { povId: selma.id, presentIds: [selma.id, au.entities[1].id], text: 'Selma olhou o porto.' })
    return { original, au, story, c1, c2, selma }
  }

  it('o autor canoniza uma história do AU: ela e as cenas viram uma história nova no original, com as fichas que usam', () => {
    const { original, au, story, c1, c2, selma } = auWithStory()
    const news = auNews(au, original)
    const item = news.find((n) => n.key === 'stories')!
    expect(item).toMatchObject({ id: story.id, state: 'novo', label: 'A Selma em Ostria', scenes: 2 })
    // As histórias do original são lore: nunca aparecem como novidade.
    expect(news.filter((n) => n.key === 'stories')).toHaveLength(1)

    const { universe, extra, stories, scenes } = canonize(original, au, [story.id])
    expect([stories, scenes]).toEqual([1, 2])
    expect(extra).toEqual([selma.id])
    expect(universe.stories.at(-1)).toMatchObject({ id: story.id, title: 'A Selma em Ostria' })
    expect(universe.scenes.filter((c) => c.storyId === story.id).map((c) => c.id)).toEqual([c1.id, c2.id])
    expect(universe.scenes.find((c) => c.id === c2.id)).toMatchObject({ povId: selma.id, text: 'Selma olhou o porto.' })
    expect(universe.entities.some((e) => e.id === selma.id)).toBe(true)
    // O resto do original continua como estava.
    expect(universe.stories.slice(0, original.stories.length)).toEqual(original.stories)
    expect(universe.scenes.slice(0, original.scenes.length)).toEqual(original.scenes)
    // Já canonizada: some da lista, e, ao trazer as novidades, vira "do original" no AU sem duplicar.
    expect(auNews(au, universe).filter((n) => n.key === 'stories')).toEqual([])
    const back = pullOriginal(au, universe).universe
    expect(back.stories.filter((x) => x.id === story.id)).toHaveLength(1)
    expect(originState(back, back.stories.find((x) => x.id === story.id)!)).toBe('original')
    expect(back.scenes.filter((c) => c.storyId === story.id)).toHaveLength(2)
  })

  it('cena nova numa história já canonizada aparece como "mudou" e só traz o que falta', () => {
    const { original, au, story } = auWithStory()
    const first = canonize(original, au, [story.id]).universe
    const [au2, c3] = addScene(au, story.id, 'Terceira cena')
    const news = auNews(au2, first).find((n) => n.key === 'stories')!
    expect(news).toMatchObject({ state: 'mudou', scenes: 1 })
    const again = canonize(first, au2, [story.id])
    expect(again.universe.scenes.filter((c) => c.storyId === story.id).map((c) => c.id)).toContain(c3.id)
    expect(again.universe.stories.filter((x) => x.id === story.id)).toHaveLength(1)
    expect(again.universe.scenes.filter((c) => c.storyId === story.id)).toHaveLength(3)
  })

  it('uma história do original (lore) não vira novidade, mesmo mexida no AU; e um fato não aponta para cena que não veio', () => {
    const original = ostriaUniverse()
    let au = createAU(original, owner)
    const lore = au.stories[0]
    au = { ...au, stories: au.stories.map((x) => (x.id === lore.id ? { ...x, title: 'Mexi na lore' } : x)) }
    expect(auNews(au, original).some((n) => n.key === 'stories')).toBe(false)
    expect(canonize(original, au, [lore.id]).stories).toBe(0)
    // Um fato do AU que cita uma cena que só existe no AU: ao canonizar o fato sozinho, a cena fica de fora.
    const [withScene, scene] = addScene(au, null, 'Só no AU')
    const fact = { ...withScene.facts[0], id: 'fato-do-au', sourceSceneId: scene.id, value: 'novo valor' }
    const result = canonize(original, { ...withScene, facts: [...withScene.facts, fact] }, ['fato-do-au'])
    expect(result.universe.facts.find((f) => f.id === 'fato-do-au')!.sourceSceneId).toBeNull()
  })
})
