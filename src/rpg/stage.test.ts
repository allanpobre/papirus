import { describe, expect, it } from 'vitest'
import type { Universe } from '../model/schema'
import { byId, createUniverse, draftGroup, insert } from '../model/universe'
import { beginSession } from './sessionLife'
import { addBeat, addClock, currentBeat, playBeat, sharedClocks, tickClock, toggleBeat } from './stage'

function table() {
  let u: Universe = createUniverse('Ostria')
  let g
  ;[u, g] = insert(u, 'groups', draftGroup('Mesa de sexta'))
  let id
  ;[u, id] = beginSession(u, g.id, null)
  for (const t of ['A chave na taverna', 'Subir pelas falésias', 'A biblioteca selada']) u = addBeat(u, id, t)
  return { u, g, id }
}

describe('o palco', () => {
  it('a cena atual: tocar numa cena começa ela; riscar a atual passa para a próxima não jogada', () => {
    let { u, id } = table()
    const [a, b, c] = byId(u, 'sessions', id)!.beats
    u = playBeat(u, id, a.id)
    expect(currentBeat(byId(u, 'sessions', id))?.title).toBe('A chave na taverna')
    u = toggleBeat(u, id, b.id) // riscar uma que não é a atual só risca
    u = toggleBeat(u, id, a.id)
    const s = byId(u, 'sessions', id)!
    expect(currentBeat(s)?.id).toBe(c.id)
    expect(s.beats.map((x) => x.done)).toEqual([true, true, false])
    expect(s.log.at(-1)!.text).toBe('Cena: A biblioteca selada')
  })

  it('relógios: enchem até o tamanho, o registro conta, e os escondidos não vão para os jogadores', () => {
    let { u, g, id } = table()
    u = addClock(u, g.id, 'A guarda chega', 4)
    u = addClock(u, g.id, 'O ritual', 6, true)
    const guarda = byId(u, 'groups', g.id)!.clocks[0]
    for (let i = 0; i < 5; i++) u = tickClock(u, g.id, guarda.id, 1)
    expect(byId(u, 'groups', g.id)!.clocks[0].filled).toBe(4)
    expect(byId(u, 'sessions', id)!.log.at(-1)!.text).toBe('Relógio cheio: A guarda chega!')
    expect(sharedClocks(byId(u, 'groups', g.id)).map((c) => c.name)).toEqual(['A guarda chega'])
  })
})
