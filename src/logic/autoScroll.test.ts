import { describe, expect, it } from 'vitest'
import { autoScrollSpeed } from './autoScroll'

describe('rolar sozinho ao arrastar perto da borda', () => {
  it('no meio da área, não rola', () => {
    expect(autoScrollSpeed(400, 0, 800)).toBe(0)
    expect(autoScrollSpeed(91, 0, 800)).toBe(0)
    expect(autoScrollSpeed(709, 0, 800)).toBe(0)
  })

  it('perto do alto rola para cima, perto de baixo rola para baixo, e quanto mais perto da borda, mais rápido', () => {
    expect(autoScrollSpeed(80, 0, 800)).toBeLessThan(0)
    expect(autoScrollSpeed(720, 0, 800)).toBeGreaterThan(0)
    expect(Math.abs(autoScrollSpeed(10, 0, 800))).toBeGreaterThan(Math.abs(autoScrollSpeed(70, 0, 800)))
    expect(autoScrollSpeed(780, 0, 800)).toBeGreaterThan(autoScrollSpeed(730, 0, 800))
  })

  it('fora da área (o dedo passou da borda), vale o máximo; nunca passa dele', () => {
    expect(autoScrollSpeed(-300, 0, 800)).toBe(-16)
    expect(autoScrollSpeed(2000, 0, 800)).toBe(16)
  })

  it('numa área pequena demais não rola (as duas bordas se encostariam)', () => {
    expect(autoScrollSpeed(50, 0, 150)).toBe(0)
  })

  it('respeita o começo da área quando ela não começa em zero (abaixo de um cabeçalho)', () => {
    expect(autoScrollSpeed(160, 100, 700)).toBeLessThan(0)
    expect(autoScrollSpeed(150, 0, 700)).toBe(0)
  })
})
