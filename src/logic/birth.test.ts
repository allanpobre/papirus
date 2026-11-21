import { describe, expect, it } from 'vitest'
import { ostriaUniverse } from '../model/sampleOstria'
import { draftEntity } from '../model/universe'
import { birthQuestions, sparkFor, tieSuggestions, tieTypes } from './birth'

const seq = (...xs: number[]) => {
  let i = 0
  return () => xs[i++ % xs.length]
}

describe('nascimento da ficha', () => {
  const u = ostriaUniverse()
  const kael = u.entities.find((e) => e.name === 'Kael')!

  it('o dado sorteia uma faísca do próprio mundo, sem usar a ficha nem os segredos', () => {
    const medo = birthQuestions('personagem').find((q) => q.key === 'Medo')!
    const nomes = u.entities.filter((e) => e.canon !== 'secreto' && e.id !== kael.id).map((e) => e.name)
    const secretos = u.entities.filter((e) => e.canon === 'secreto').map((e) => e.name).filter((s) => !nomes.some((n) => n.includes(s)))
    let doMundo = 0
    for (let i = 0; i < 40; i++) {
      const t = sparkFor(medo, u, kael.id)
      expect(t).not.toContain('Kael')
      for (const s of secretos) expect(t).not.toContain(s)
      if (nomes.some((n) => t.includes(n))) doMundo++
    }
    expect(doMundo).toBeGreaterThan(0)
  })

  it('sem faíscas para o campo, usa o exemplo da pergunta', () => {
    expect(sparkFor({ key: 'Qualquer', ask: '?', example: 'Um exemplo' }, u, kael.id, seq(0.1))).toBe('Um exemplo')
  })

  it('sugere fichas de tipos variados para ligar, sem a própria e sem segredos', () => {
    const nova = { ...draftEntity('personagem', 'Seren'), id: 'nova', createdAt: '', updatedAt: '' }
    const sug = tieSuggestions(u, nova, 6)
    expect(sug).toHaveLength(6)
    expect(new Set(sug.map((e) => e.kind)).size).toBeGreaterThan(2)
    expect(sug.some((e) => e.canon === 'secreto')).toBe(false)
    expect(tieSuggestions(u, kael).some((e) => e.id === kael.id)).toBe(false)
  })

  it('as frases de ligação dependem dos dois tipos', () => {
    expect(tieTypes('personagem', 'lugar')[0]).toBe('nasceu em')
    expect(tieTypes('personagem', 'faccao')[0]).toBe('faz parte de')
    expect(tieTypes('personagem', 'personagem')).toContain('rival de')
  })
})
