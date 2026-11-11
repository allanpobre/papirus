import { describe, expect, it } from 'vitest'
import { byId, createUniverse, draftGroup, insert } from '../model/universe'
import type { Universe } from '../model/schema'
import { readTableSheet, type TableSheet } from '../share/server'
import { acceptSheet, MAX_PLAYER_SHEETS, playerSheetsFull } from './joinSheets'
import { makeSystem } from './systems'

function table() {
  const system = { ...makeSystem('d20-5e'), fields: ['Classe', 'Raça'] }
  let u: Universe = { ...createUniverse('Ostria'), systems: [system] }
  let g
  ;[u, g] = insert(u, 'groups', { ...draftGroup('Grupo de sexta'), systemId: system.id })
  return { u, groupId: g.id, system }
}
const sheet = (name: string, extra: Partial<TableSheet> = {}): TableSheet => ({ id: crypto.randomUUID(), name, player: 'Ana', fields: [], attrs: [], ...extra })

describe('ficha criada pelo jogador', () => {
  it('entra como personagem de jogador do grupo, com o que o sistema tem, e ganha a ficha no Mundo', () => {
    const { u, groupId, system } = table()
    const [str, dex] = system.attributes
    const got = acceptSheet(u, groupId, sheet('Kaya', { fields: [['Classe', 'Ladina'], ['Inventado', 'x']], attrs: [[str.id, 99], [dex.id, -5], ['nao-existe', 12]] }))!
    const s = byId(got.universe, 'sheets', got.sheetId)!
    expect(s).toMatchObject({ name: 'Kaya', player: 'Ana', role: 'pj', groupId, systemId: system.id })
    // Atributos dentro do mínimo e do máximo; o que o sistema não tem fica de fora.
    expect(s.attributes[str.id]).toBe(str.max)
    expect(s.attributes[dex.id]).toBe(dex.min)
    expect(s.attributes['nao-existe']).toBeUndefined()
    expect(s.fields).toEqual({ Classe: 'Ladina', Raça: '' })
    // Um personagem só: a ficha do Mundo.
    expect(byId(got.universe, 'entities', s.entityId!)).toMatchObject({ kind: 'personagem', name: 'Kaya' })
  })

  it('nome repetido no grupo (o pedido chegou duas vezes, ou o mestre já criou) não entra de novo', () => {
    const { u, groupId } = table()
    const first = acceptSheet(u, groupId, sheet('Kaya'))!
    expect(acceptSheet(first.universe, groupId, sheet('  KAYA '))).toBeNull()
    expect(acceptSheet(u, 'outro-grupo', sheet('Kaya'))).toBeNull()
    expect(acceptSheet(u, groupId, sheet('   '))).toBeNull()
  })

  it(`o grupo aceita até ${MAX_PLAYER_SHEETS} personagens de jogador`, () => {
    let { u, groupId } = table()
    for (let i = 0; i < MAX_PLAYER_SHEETS; i++) u = acceptSheet(u, groupId, sheet(`P${i}`))!.universe
    expect(playerSheetsFull(u, groupId)).toBe(true)
    expect(acceptSheet(u, groupId, sheet('Mais um'))).toBeNull()
  })

  it('o que chega pelo canal só passa com a forma certa', () => {
    const ok = sheet('Kaya', { fields: [['Classe', ' Ladina '], ['Raça', '']], attrs: [['a', 14]] })
    expect(readTableSheet(ok)).toEqual({ ...ok, fields: [['Classe', 'Ladina']] })
    expect(readTableSheet(null)).toBeNull()
    expect(readTableSheet({ ...ok, name: '' })).toBeNull()
    expect(readTableSheet({ ...ok, name: 'x'.repeat(61) })).toBeNull()
    expect(readTableSheet({ ...ok, attrs: [['a', 1.5]] })).toBeNull()
    expect(readTableSheet({ ...ok, attrs: [['a', '14']] })).toBeNull()
    expect(readTableSheet({ ...ok, fields: 'Classe' })).toBeNull()
    expect(readTableSheet({ ...ok, fields: Array.from({ length: 17 }, (_, i) => [`c${i}`, 'v']) })).toBeNull()
    expect(readTableSheet({ id: 'x', name: 'Kaya' })).toEqual({ id: 'x', name: 'Kaya', player: '', fields: [], attrs: [] })
  })
})
