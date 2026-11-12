import { describe, expect, it } from 'vitest'
import { ostriaUniverse } from '../model/sampleOstria'
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
})
