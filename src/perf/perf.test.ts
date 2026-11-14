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

describe('contas de "quem aparece" guardadas', () => {
  it('a segunda tela que pede a mesma conta recebe a guardada, e mexer só numa ficha não refaz a conta do manuscrito', async () => {
    const { sceneCounts } = await import('../logic/appearances')
    const { bookOnly } = await import('../model/universe')
    const livro = u.stories[0].id
    const [first, ms1] = time('sceneCounts (primeira vez, livro inteiro)', () => sceneCounts(u))
    const [again, ms2] = time('sceneCounts (guardada)', () => sceneCounts(u))
    expect(again).toBe(first)
    expect(ms2).toBeLessThan(Math.max(5, ms1 / 20))
    // Um livro só: o recorte também é guardado, então a segunda tela não refaz.
    time('sceneCounts do livro 1 (primeira vez)', () => sceneCounts(bookOnly(u, livro)))
    const [, ms3] = time('sceneCounts do livro 1 (outra tela)', () => sceneCounts(bookOnly(u, livro)))
    expect(ms3).toBeLessThan(Math.max(5, ms1 / 20))
    // Mexer numa ficha (outro array de fichas) refaz; mexer em outra coisa (os fatos, por exemplo) não.
    const semMudar = { ...u, facts: [...u.facts] }
    expect(sceneCounts(semMudar)).toBe(first)
    const outraFicha = { ...u, entities: [...u.entities] }
    expect(sceneCounts(outraFicha)).not.toBe(first)
  })
})

describe('conferência do texto do livro', () => {
  it('é guardada: a segunda vez (outra visita a Publicar) não refaz a conta', async () => {
    const { reviewBook, reviewIfDone } = await import('../logic/review')
    const { defaultDesign } = await import('../export/bookDesign')
    const d = defaultDesign()
    expect(reviewIfDone(u, d)).toBeUndefined()
    const [first, ms1] = time('reviewBook (primeira vez)', () => reviewBook(u, d))
    const [again, ms2] = time('reviewBook (guardada)', () => reviewBook(u, d))
    expect(again).toBe(first)
    expect(reviewIfDone(u, d)).toBe(first)
    expect(ms2).toBeLessThan(Math.max(5, ms1 / 20))
  })
})
