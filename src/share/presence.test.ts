import { describe, expect, it } from 'vitest'
import { alive, playersAt, PRESENCE_TTL, withPresence, type Present } from './presence'

const at = (list: Present[], id: string, who: string | null, now: number, role: 'mestre' | 'jogador' = 'jogador') => withPresence(list, { id, role, who }, now)

describe('quem está na mesa', () => {
  it('o aviso mais novo de cada aparelho vale', () => {
    let list = at([], 'a', null, 0)
    list = at(list, 'a', 'Taren', 1000)
    expect(list).toEqual([{ id: 'a', role: 'jogador', who: 'Taren', seen: 1000 }])
  })

  it('quem para de avisar sai sozinho', () => {
    const list = at(at([], 'a', 'Taren', 0), 'b', 'Brisa', 30_000)
    expect(alive(list, PRESENCE_TTL - 1).map((p) => p.id)).toEqual(['a', 'b'])
    expect(alive(list, PRESENCE_TTL + 1).map((p) => p.id)).toEqual(['b'])
  })

  it('um nome por personagem, sem o mestre, e quem ainda não escolheu por último', () => {
    let list = at([], 'm', null, 0, 'mestre')
    list = at(list, 'x', null, 0)
    list = at(list, 'a', 'Taren', 0)
    list = at(list, 'b', 'Taren', 0)
    list = at(list, 'c', 'Brisa', 0)
    expect(playersAt(list, 1000)).toEqual([
      { name: 'Brisa', count: 1 },
      { name: 'Taren', count: 2 },
      { name: null, count: 1 },
    ])
  })
})
