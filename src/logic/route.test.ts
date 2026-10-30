import { describe, expect, it } from 'vitest'
import { ostriaUniverse } from '../model/sampleOstria'
import { draftMap, insert } from '../model/universe'
import { sceneCounts } from './appearances'
import { glimpseOf, rangeText, routeOn } from './route'

describe('caminho no mapa', () => {
  it('segue as cenas do personagem, juntando cenas seguidas no mesmo lugar', () => {
    let u = ostriaUniverse()
    const id = (name: string) => u.entities.find((e) => e.name === name)!.id
    let map
    ;[u, map] = insert(u, 'maps', {
      ...draftMap('Costa', 'data:,', 100, 100),
      pins: [
        { id: 'p1', entityId: id('Ostria'), x: 0.2, y: 0.5, label: '' },
        { id: 'p2', entityId: id('Vale das Brumas'), x: 0.8, y: 0.2, label: '' },
      ],
    })
    const route = routeOn(u, map, id('Kael'))
    // A Taverna do Anzol fica em Ostria: cai no marcador de Ostria.
    expect(route.map((r) => `${r.place} ${rangeText(r.scenes)}`)).toEqual(['Ostria 1', 'Vale das Brumas 3', 'Ostria 4, 7–8'])
  })

  it('a ficha mostra onde está: o marcador, o caminho, ou o lugar que a contém', () => {
    let u = ostriaUniverse()
    const id = (name: string) => u.entities.find((e) => e.name === name)!.id
    // O exemplo já vem com o mapa do reino.
    expect(glimpseOf(u, id('Torre de Marfim'))?.pin?.label).toBe('Torre de Marfim')
    expect(glimpseOf(u, id('Kael'))?.route.map((r) => r.place)).toEqual(['Ostria', 'Vale das Brumas', 'Ostria', 'Taverna do Anzol', 'Torre de Marfim'])
    // Sem marcador próprio, vale o do lugar em que fica.
    u = { ...u, maps: u.maps.map((m) => ({ ...m, pins: m.pins.filter((p) => p.entityId !== id('Torre de Marfim')) })) }
    expect(glimpseOf(u, id('Torre de Marfim'))).toMatchObject({ inside: id('Ostria'), pin: { label: 'Ostria' } })
    // Fora de qualquer mapa: nada.
    expect(glimpseOf(u, id('Fé da Maré'))).toBeNull()
  })

  it('conta em quantas cenas cada ficha aparece, de qualquer jeito', () => {
    const u = ostriaUniverse()
    const id = (name: string) => u.entities.find((e) => e.name === name)!.id
    const counts = sceneCounts(u)
    expect(counts.get(id('Kael'))).toBe(5)
    expect(counts.get(id('Casa de Vaelor')) ?? 0).toBe(0)
  })

  it('escreve intervalos', () => {
    expect(rangeText([1, 2, 3, 5, 7, 8])).toBe('1–3, 5, 7–8')
  })
})
