import { describe, expect, it } from 'vitest'
import { relativeDate } from './relativeDate'

describe('datas do jeito que se fala', () => {
  const now = new Date(2026, 10, 8, 14, 0)
  const at = (y: number, m: number, d: number, h = 10, min = 0) => new Date(y, m, d, h, min).toISOString()

  it('hoje com a hora, ontem, dias, semanas, meses e a data', () => {
    expect(relativeDate(at(2026, 10, 8, 9, 5), now)).toBe('hoje, 09:05')
    // Ontem é o dia de calendário, mesmo que tenha sido há menos de 24 horas.
    expect(relativeDate(at(2026, 10, 7, 23, 50), now)).toBe('ontem')
    expect(relativeDate(at(2026, 10, 5), now)).toBe('há 3 dias')
    expect(relativeDate(at(2026, 10, 1), now)).toBe('há 1 semana')
    expect(relativeDate(at(2026, 9, 20), now)).toBe('há 2 semanas')
    expect(relativeDate(at(2026, 8, 1), now)).toBe('há 2 meses')
    expect(relativeDate(at(2025, 5, 1), now)).toMatch(/2025/)
    expect(relativeDate('não é data', now)).toBe('')
  })
})
