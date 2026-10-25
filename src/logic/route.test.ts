import { describe, expect, it } from 'vitest'
import { ostriaUniverse } from '../model/sampleOstria'
import { draftMap, insert } from '../model/universe'
import { rangeText, routeOn } from './route'

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

  it('escreve intervalos', () => {
    expect(rangeText([1, 2, 3, 5, 7, 8])).toBe('1–3, 5, 7–8')
  })
})
