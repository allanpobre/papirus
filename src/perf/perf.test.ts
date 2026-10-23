import { describe, expect, it } from 'vitest'
import { codexFor } from '../logic/codex'
import { continuityQuestions } from '../logic/continuity'
import { findCandidates, MentionMatcher } from '../logic/detection'
import { searchUniverse } from '../logic/search'
import { presenceMatrix } from '../logic/stats'
import { universeSchema } from '../model/schema'
import { draftGroup, insert } from '../model/universe'
import { bigUniverse } from './bigUniverse'

/**
 * Desempenho com um universo grande: 600 fichas, 900 cenas (~1 milhão de palavras),
 * 2000 fatos. Os limites são folgados (máquinas de CI variam); servem para pegar
 * regressões de complexidade, não para medir milissegundos.
 */
const u = bigUniverse()
const time = <T,>(label: string, fn: () => T): [T, number] => {
  const t = performance.now()
  const r = fn()
  const ms = performance.now() - t
  console.log(`${label}: ${ms.toFixed(1)} ms`)
  return [r, ms]
}

describe('universo grande', () => {
  it('tem o tamanho esperado', () => {
    expect(u.scenes).toHaveLength(900)
    expect(u.entities).toHaveLength(600)
  })

  it('valida e serializa', () => {
    const [, parse] = time('schema', () => universeSchema.parse(u))
    const [json, stringify] = time('JSON', () => JSON.stringify(u))
    console.log(`tamanho: ${(json.length / 1e6).toFixed(1)} MB`)
    expect(parse).toBeLessThan(3000)
    expect(stringify).toBeLessThan(1500)
  })

  it('detecta nomes numa cena rápido o bastante para cada tecla', () => {
    const [matcher, build] = time('matcher', () => new MentionMatcher(u.entities))
    const text = u.scenes[0].text
    const [found, scan] = time('detecção numa cena', () => matcher.find(text))
    const [, cand] = time('candidatos numa cena', () => findCandidates(text, u.entities))
    expect(found.length).toBeGreaterThan(0)
    expect(build).toBeLessThan(500)
    expect(scan).toBeLessThan(100)
    expect(cand).toBeLessThan(300)
  })

  it('continuidade, presença, busca e Codex', () => {
    const [, cold] = time('busca (primeira)', () => searchUniverse(u, 'porta'))
    const [qs, cont] = time('continuidade', () => continuityQuestions(u))
    const [, pres] = time('presença', () => presenceMatrix(u))
    const [, search] = time('busca', () => searchUniverse(u, 'torre'))
    const [g, group] = insert(u, 'groups', draftGroup('Mesa'))
    const [, codex] = time('codex', () => codexFor(g, group.id))
    expect(qs.length).toBeGreaterThan(0)
    expect(cont).toBeLessThan(1500)
    expect(pres).toBeLessThan(3000)
    expect(cold).toBeLessThan(1500)
    expect(search).toBeLessThan(200)
    expect(codex).toBeLessThan(500)
  })
})
