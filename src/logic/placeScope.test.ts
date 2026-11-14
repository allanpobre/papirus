import { describe, expect, it } from 'vitest'
import { createUniverse } from '../model/universe'
import type { Universe } from '../model/schema'
import { placesInRegion, placesWithin, regionChoices } from './placeScope'

const ent = (id: string, name: string, parentId: string | null = null) => ({ id, name, kind: 'lugar', parentId, fields: [] }) as unknown as Universe['entities'][number]

function world(): Universe {
  const u = createUniverse('t')
  u.entities = [ent('reino', 'Reino'), ent('cidade', 'Cidade', 'reino'), ent('torre', 'Torre', 'cidade'), ent('vale', 'Vale', 'reino'), ent('casa', 'Casa de Vaelor'), ent('longe', 'Longe')]
  u.maps = [
    {
      id: 'm1',
      name: 'Reino',
      pins: [
        { id: 'p1', entityId: 'cidade', x: 0.5, y: 0.5, label: '' },
        { id: 'p2', entityId: 'vale', x: 0.9, y: 0.1, label: '' },
        { id: 'p3', entityId: 'longe', x: 0.1, y: 0.9, label: '' },
      ],
      regions: [{ id: 'r1', entityId: 'casa', points: [[0.3, 0.3], [0.7, 0.3], [0.7, 0.7], [0.3, 0.7]], fromYear: null, toYear: null }],
    },
  ] as unknown as Universe['maps']
  return u
}

describe('filtrar por lugar e por região', () => {
  it('um lugar traz os lugares dentro dele, em qualquer fundo', () => {
    const u = world()
    expect([...placesWithin(u, 'reino')].sort()).toEqual(['cidade', 'reino', 'torre', 'vale'])
    expect([...placesWithin(u, 'cidade')].sort()).toEqual(['cidade', 'torre'])
    expect([...placesWithin(u, 'torre')]).toEqual(['torre'])
  })

  it('um ciclo de "fica em" não trava', () => {
    const u = world()
    u.entities = u.entities.map((e) => (e.id === 'reino' ? { ...e, parentId: 'torre' } : e))
    expect([...placesWithin(u, 'reino')].sort()).toEqual(['cidade', 'reino', 'torre', 'vale'])
  })

  it('uma região traz o dono, os lugares marcados dentro do desenho e o que fica dentro deles', () => {
    const u = world()
    const set = placesInRegion(u, 'm1:r1')
    // A cidade está dentro do desenho; a torre fica dentro da cidade; o dono (Casa de Vaelor) também entra.
    expect([...set].sort()).toEqual(['casa', 'cidade', 'torre'])
    // O vale e o "longe" estão fora do desenho.
    expect(set.has('vale')).toBe(false)
    expect(set.has('longe')).toBe(false)
  })

  it('uma região que não existe mais não traz nada', () => {
    expect(placesInRegion(world(), 'm1:sumiu').size).toBe(0)
    expect(placesInRegion(world(), 'outro:r1').size).toBe(0)
  })

  it('as regiões têm o nome do dono; com mais de um mapa, também o do mapa', () => {
    const u = world()
    expect(regionChoices(u)).toEqual([{ key: 'm1:r1', label: 'Casa de Vaelor' }])
    u.maps = [...u.maps, { ...u.maps[0], id: 'm2', name: 'Cidade', regions: [] }]
    expect(regionChoices(u)).toEqual([{ key: 'm1:r1', label: 'Casa de Vaelor (Reino)' }])
  })
})
