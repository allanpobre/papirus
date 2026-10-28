// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { PAGE_TOURS } from './pageTours'

describe('tours de cada tela', () => {
  it('todo tour tem título, passos com texto e seletores válidos', () => {
    for (const [id, tour] of Object.entries(PAGE_TOURS)) {
      expect(tour.title, id).toBeTruthy()
      expect(tour.steps.length, id).toBeGreaterThan(0)
      // Pelo menos um passo aparece sempre (não é opcional), para o tour nunca abrir vazio.
      expect(tour.steps.some((s) => !('optional' in s && s.optional)), id).toBe(true)
      for (const s of tour.steps) {
        expect(s.title && s.body, `${id}: ${s.title}`).toBeTruthy()
        if ('target' in s && s.target) expect(() => document.querySelector(s.target), `${id}: ${s.target}`).not.toThrow()
      }
    }
  })
})
