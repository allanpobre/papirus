import { describe, expect, it } from 'vitest'
import { ALL_ITEMS } from './nav'
import { allTools, TOOL_HINTS } from './toolsList'

describe('Todas as ferramentas', () => {
  it('toda área do menu tem uma frase', () => {
    for (const item of ALL_ITEMS) expect(TOOL_HINTS[item.view], `falta a frase de ${item.label}`).toBeTruthy()
  })

  it('diz por que uma área está fora do menu', () => {
    const rows = allTools(['tramas', 'conhecimento', 'inbox'], true)
    const por = (v: string) => rows.find((r) => r.item.view === v)?.hiddenBecause
    expect(por('tramas')).toBe('simples')
    expect(por('conhecimento')).toBe('simples')
    // Escondida à mão (Menu e ajuda), mesmo no Simples.
    expect(por('inbox')).toBe('menu')
    expect(por('fichas')).toBeNull()
    // No Completo, uma Trama escondida à mão é "do menu", não do Simples.
    expect(allTools(['tramas'], false).find((r) => r.item.view === 'tramas')?.hiddenBecause).toBe('menu')
  })
})
