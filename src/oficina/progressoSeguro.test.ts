// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('o caminho guardado na Oficina', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
  })

  it('uma trilha guardada que não existe mais não derruba o passo de hoje', async () => {
    localStorage.setItem('papirus:oficina', JSON.stringify({ read: [], done: [], steps: [], trail: 'trilha-que-sumiu', asked: true, notes: {} }))
    const { oficinaProgress } = await import('./progress')
    const { todayStep } = await import('./trails')
    expect(oficinaProgress().trail).toBeNull()
    expect(todayStep(oficinaProgress())?.trail.id).toBe('fundamentos')
  })

  it('uma trilha que existe continua escolhida', async () => {
    localStorage.setItem('papirus:oficina', JSON.stringify({ trail: 'dialogo', asked: true }))
    const { oficinaProgress } = await import('./progress')
    expect(oficinaProgress().trail).toBe('dialogo')
  })
})
