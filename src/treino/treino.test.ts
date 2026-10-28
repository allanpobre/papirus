// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { addTreino, attemptsOf, charCount, measure, mergeFromCloud, pendingFor, recordOf, removeTreino, summary, treinoStreak, treinos, type Treino } from './treino'

const base: Treino = { id: 'a', day: '2026-10-28', prompt: 'Uma carta', daily: true, minutes: 15, target: 300, unit: 'palavras', words: 320, chars: 1800, seconds: 900, done: true, text: 'x', at: '2026-10-28T10:00:00Z' }
const t = (o: Partial<Treino>): Treino => ({ ...base, ...o })

describe('treinos de escrita', () => {
  beforeEach(() => {
    localStorage.clear()
    // O módulo guarda um cache: zera apagando tudo o que existir.
    for (const x of treinos()) removeTreino(x.id)
    localStorage.clear()
  })

  it('conta palavras e caracteres (com espaços, sem as quebras das pontas)', () => {
    expect(measure('  Era uma vez.\n', 'palavras')).toBe(3)
    expect(charCount('  Era uma vez.\n')).toBe(12)
    expect(measure('Coração é ação', 'caracteres')).toBe(14)
  })

  it('dias seguidos contam só treinos com o mínimo batido, até hoje ou ontem', () => {
    const list = [t({ id: '1', day: '2026-10-26' }), t({ id: '2', day: '2026-10-27' }), t({ id: '3', day: '2026-10-28', done: false })]
    expect(treinoStreak(list, '2026-10-28')).toBe(2)
    expect(treinoStreak(list, '2026-10-30')).toBe(0)
  })

  it('o recorde é por desafio, unidade e tempo', () => {
    const list = [t({ id: '1', words: 200 }), t({ id: '2', words: 350 }), t({ id: '3', words: 900, minutes: 30 }), t({ id: '4', words: 999, prompt: 'Outro' })]
    expect(recordOf(list, base)?.id).toBe('2')
    expect(attemptsOf(list, base)).toHaveLength(3)
    expect(summary(list, '2026-10-28').total).toBe(4)
  })

  it('nuvem: sobe o que falta, junta o que veio de fora e lembra o que foi apagado', () => {
    addTreino(t({ id: 'local' }))
    expect(pendingFor('ana').upload.map((x) => x.id)).toEqual(['local'])
    mergeFromCloud('ana', [t({ id: 'outro-aparelho', at: '2026-10-29T10:00:00Z' })], ['local'])
    expect(treinos().map((x) => x.id)).toEqual(['outro-aparelho', 'local'])
    expect(pendingFor('ana').upload).toHaveLength(0)
    // Outra conta neste aparelho ainda precisa receber os dois.
    expect(pendingFor('bia').upload).toHaveLength(2)
    removeTreino('local')
    expect(pendingFor('ana').remove).toEqual(['local'])
    // Mesmo que a nuvem ainda o devolva, não volta.
    mergeFromCloud('ana', [t({ id: 'local' })])
    expect(treinos().map((x) => x.id)).toEqual(['outro-aparelho'])
  })
})
