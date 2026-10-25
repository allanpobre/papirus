// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { streakDays } from './dailyWords'

describe('dias seguidos', () => {
  beforeEach(() => localStorage.clear())
  it('conta os dias até hoje com a meta batida, e para no primeiro que falhou', () => {
    localStorage.setItem('papirus:palavras-por-dia', JSON.stringify({ '2026-10-20': 900, '2026-10-22': 600, '2026-10-23': 500, '2026-10-24': 800 }))
    expect(streakDays(500, '2026-10-24')).toBe(3)
    expect(streakDays(700, '2026-10-24')).toBe(1)
    expect(streakDays(500, '2026-10-25')).toBe(0)
  })
})
