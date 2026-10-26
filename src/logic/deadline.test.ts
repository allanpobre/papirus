import { describe, expect, it } from 'vitest'
import type { Universe } from '../model/schema'
import { createUniverse } from '../model/universe'
import { deadlinePlan } from './deadline'

const withWords = (n: number, deadline: { words: number; date: string } | null, start?: number): Universe => {
  const u = createUniverse('X')
  const text = Array.from({ length: n }, () => 'palavra').join(' ')
  return {
    ...u,
    scenes: [{ ...(u.scenes[0] ?? ({} as never)), id: 's', title: '', text } as never],
    settings: { ...u.settings, deadline },
    dailyStart: (start === undefined ? {} : { '2026-10-26': start }) as Record<string, number>,
  }
}

describe('meta com prazo', () => {
  const now = new Date('2026-10-26T15:00:00')
  it('divide o que falta pelos dias até o prazo, contando hoje', () => {
    const p = deadlinePlan(withWords(1000, { words: 11000, date: '2026-11-04' }, 1000), now)!
    expect(p.daysLeft).toBe(10)
    expect(p.perDay).toBe(1000)
    expect(p.left).toBe(10000)
  })
  it('usa o começo do dia: escrever hoje não muda a conta de hoje', () => {
    const p = deadlinePlan(withWords(1500, { words: 11000, date: '2026-11-04' }, 1000), now)!
    expect(p.perDay).toBe(1000)
    expect(p.left).toBe(9500)
  })
  it('meta batida e prazo vencido', () => {
    expect(deadlinePlan(withWords(50, { words: 40, date: '2026-11-04' }), now)!.done).toBe(true)
    const late = deadlinePlan(withWords(10, { words: 40, date: '2026-10-20' }), now)!
    expect(late.late).toBe(true)
    expect(late.perDay).toBe(0)
  })
  it('sem meta, nada', () => {
    expect(deadlinePlan(withWords(10, null), now)).toBeNull()
  })
})
