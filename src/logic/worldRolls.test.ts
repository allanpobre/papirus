import { describe, expect, it } from 'vitest'
import { ostriaUniverse } from '../model/sampleOstria'
import { createUniverse } from '../model/universe'
import { fillEntry, rollTable, WORLD_TABLES } from './worldRolls'

const seq = (...xs: number[]) => {
  let i = 0
  return () => xs[i++ % xs.length]
}

describe('rolar no mundo', () => {
  it('as marcas viram nomes do mundo (e as fichas entram na lista), sem segredos', () => {
    const u = ostriaUniverse()
    const r = fillEntry('Dizem que {personagem} foi visto em {lugar}.', u, seq(0.1, 0.3, 0.5))
    expect(r.text).not.toMatch(/\{|\}/)
    expect(r.entityIds.length).toBe(2)
    const secretos = new Set(u.entities.filter((e) => e.canon === 'secreto').map((e) => e.id))
    for (let i = 0; i < 30; i++) expect(fillEntry('{personagem} {lugar} {grupo}', u).entityIds.some((id) => secretos.has(id))).toBe(false)
  })

  it('num mundo vazio, entra uma palavra comum; marca desconhecida fica como está', () => {
    const r = fillEntry('{lugar} e {xyz}', createUniverse('Vazio'), seq(0))
    expect(r.text).toBe('o porto e {xyz}')
    expect(r.entityIds).toEqual([])
  })

  it('toda tabela pronta rola um texto sem marcas', () => {
    const u = ostriaUniverse()
    for (const t of WORLD_TABLES) expect(rollTable(t, u)!.text).not.toMatch(/\{\w+\}/)
    expect(rollTable({ entries: [' '] }, u)).toBeNull()
  })
})
