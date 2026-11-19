import { describe, expect, it } from 'vitest'
import { addSoundCard, kindNames, translate, wordFor } from './language'

const lang = { syllables: addSoundCard([], 'aspero'), sounds: '', example: '', placeEnding: '-heim', familyPrefix: 'Mac' }
let n = 0
const rnd = () => ((n = (n * 9301 + 49297) % 233280) / 233280)

describe('língua de verdade', () => {
  it('carta de som junta sílabas sem repetir', () => {
    expect(addSoundCard(['kar-'], 'aspero').filter((s) => s === 'kar-')).toHaveLength(1)
    expect(addSoundCard([], 'nada')).toEqual([])
  })
  it('lugar termina no fim de lugar e família começa pelo prefixo', () => {
    for (const p of kindNames(lang, 'lugar', 4, rnd)) expect(p.endsWith('heim')).toBe(true)
    for (const f of kindNames(lang, 'familia', 4, rnd)) expect(f.startsWith('Mac ')).toBe(true)
  })
  it('a mesma palavra traduz sempre igual; o dicionário vale', () => {
    expect(wordFor(lang, 'rio')).toBe(wordFor(lang, 'Rio'))
    const t = translate({ ...lang, words: [{ word: 'dur', meaning: 'rio' }] }, 'O rio é largo!')
    expect(t[0]).toEqual({ pt: 'O', word: '', known: true })
    expect(t[1]).toEqual({ pt: 'rio', word: 'dur', known: true })
    expect(t[3].known).toBe(false)
    expect(t[3].word).toBe(wordFor(lang, 'largo'))
  })
})
