import { describe, expect, it } from 'vitest'
import { addDefiner, choose } from './definers'
import { cultureOf, hasLanguage, languageNames, languagesOf, parseSyllables } from './language'
import { createUniverse, draftEntity, insert, patch } from '../model/universe'

// Sorteio previsível.
const seeded = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647
  return (seed - 1) / 2147483646
}

describe('idioma: sílabas', () => {
  it('lê as sílabas separadas por espaço, vírgula ou ponto e vírgula, sem repetir e em minúsculas', () => {
    expect(parseSyllables('Ka, Ul thor; ka  Ren')).toEqual(['ka', 'ul', 'thor', 'ren'])
  })

  it('"kar-" só abre nomes e "-dor" só fecha; o que não é letra ou passa de 6 letras sai', () => {
    expect(parseSyllables('kar- -dor ul 123 muitoComprido x-y')).toEqual(['kar-', '-dor', 'ul'])
  })
})

describe('idioma: nomes', () => {
  const lang = { syllables: ['ka', 'ren', 'thor', 'ul', 'mi', 'dra'], sounds: '', example: '' }

  it('monta nomes só com as sílabas do idioma, com maiúscula e sem repetir', () => {
    const names = languageNames(lang, 8, seeded(5))
    expect(names).toHaveLength(8)
    expect(new Set(names).size).toBe(8)
    for (const n of names) {
      expect(n).toMatch(/^\p{Lu}\p{Ll}+$/u)
      // Dá para refazer o nome só com as sílabas.
      const rest = n.toLocaleLowerCase('pt-BR')
      const ok = (s: string): boolean => s === '' || lang.syllables.some((y) => s.startsWith(y) && ok(s.slice(y.length)))
      expect(ok(rest), n).toBe(true)
    }
  })

  it('"kar-" abre e "-dor" fecha: nunca no meio nem do outro lado', () => {
    const names = languageNames({ syllables: ['kar-', 'vel-', '-dor', '-ath', 'ul', 'en'], sounds: '', example: '' }, 12, seeded(9))
    expect(names.length).toBeGreaterThan(5)
    for (const n of names) {
      const l = n.toLowerCase()
      expect(/^(kar|vel|ul|en)/.test(l), n).toBe(true)
      expect(/(dor|ath|ul|en)$/.test(l), n).toBe(true)
      // "dor" e "ath" só no fim; "kar" e "vel" só no começo.
      expect(l.slice(1)).not.toMatch(/kar|vel/)
      expect(l.slice(0, -3)).not.toMatch(/dor|ath/)
    }
  })

  it('não repete nomes que o mundo já tem, e o mesmo sorteio dá os mesmos nomes', () => {
    const first = languageNames(lang, 6, seeded(2))
    const again = languageNames(lang, 6, seeded(2), first.slice(0, 3))
    expect(again.some((n) => first.slice(0, 3).includes(n))).toBe(false)
    expect(languageNames(lang, 6, seeded(2))).toEqual(first)
  })

  it('sem sílabas que bastem, não inventa nada', () => {
    expect(languageNames({ syllables: [], sounds: '', example: '' })).toEqual([])
    expect(languageNames({ syllables: ['ka'], sounds: '', example: '' })).toEqual([])
    expect(languageNames({ syllables: ['kar-', 'kar-'], sounds: '', example: '' })).toEqual([])
  })

  it('com poucas sílabas, devolve os nomes que dá para fazer (sem travar)', () => {
    const few = languageNames({ syllables: ['ka', 'ul'], sounds: '', example: '' }, 10, seeded(1))
    expect(few.length).toBeLessThanOrEqual(10)
    expect(few.length).toBeGreaterThan(0)
  })
})

describe('idioma: a que povo uma ficha pertence', () => {
  it('pelo "Quem é": a ficha escolheu o povo, e o povo tem idioma', () => {
    let u = createUniverse('t')
    let povo
    ;[u, povo] = addDefiner(u, 'Povo', ['personagem'])
    let munch, winkie, ana
    ;[u, munch] = insert(u, 'entities', draftEntity(povo.kind, 'Munchkins'))
    ;[u, winkie] = insert(u, 'entities', draftEntity(povo.kind, 'Winkies'))
    ;[u, ana] = insert(u, 'entities', draftEntity('personagem', 'Ana'))
    u = patch(u, 'entities', munch.id, { language: { syllables: ['mun', 'ki', 'ko', 'pi'], sounds: 'redondo', example: '' } })
    expect(languagesOf(u).map((e) => e.name)).toEqual(['Munchkins'])
    expect(hasLanguage(u.entities.find((e) => e.id === munch.id)!)).toBe(true)
    expect(hasLanguage(u.entities.find((e) => e.id === winkie.id)!)).toBe(false)
    // Sem escolher o povo, não pertence a nenhum.
    expect(cultureOf(u, ana.id)).toBeNull()
    u = choose(u, ana.id, povo, munch.id)
    expect(cultureOf(u, ana.id)?.name).toBe('Munchkins')
    // Um povo sem idioma não conta.
    u = choose(u, ana.id, povo, winkie.id)
    expect(cultureOf(u, ana.id)).toBeNull()
  })
})
