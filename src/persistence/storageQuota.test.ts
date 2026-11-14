import { describe, expect, it } from 'vitest'
import { formatBytes, storageUse } from './storageQuota'

describe('aviso de espaço', () => {
  it('só avisa a partir de 80% do espaço que o navegador permite', () => {
    expect(storageUse(50, 100)).toEqual({ percent: 50, level: 'ok' })
    expect(storageUse(79, 100)?.level).toBe('ok')
    expect(storageUse(80, 100)).toEqual({ percent: 80, level: 'quase' })
    expect(storageUse(94, 100)?.level).toBe('quase')
    expect(storageUse(95, 100)).toEqual({ percent: 95, level: 'cheio' })
    // Passou do limite (acontece): a porcentagem não passa de 100.
    expect(storageUse(120, 100)).toEqual({ percent: 100, level: 'cheio' })
  })

  it('sem número confiável do navegador, não avisa', () => {
    expect(storageUse(10, 0)).toBeNull()
    expect(storageUse(NaN, 100)).toBeNull()
    expect(storageUse(-1, 100)).toBeNull()
    expect(storageUse(10, Infinity)).toBeNull()
  })

  it('escreve os tamanhos em português', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2048)).toBe('2 KB')
    expect(formatBytes(1.5 * 1024 * 1024)).toBe('1,5 MB')
    expect(formatBytes(3 * 1024 ** 3)).toBe('3 GB')
  })
})
