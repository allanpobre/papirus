import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { KindPortrait, kindVar } from './KindPortrait'

describe('retrato do tipo', () => {
  it('a cor vem do tipo; nome com espaço, acento ou maiúscula usa a cor de destaque', () => {
    expect(kindVar('personagem')).toBe('var(--kind-personagem, var(--accent))')
    expect(kindVar('Língua falada')).toBe('var(--accent)')
    expect(kindVar('Navio')).toBe('var(--accent)')
    expect(kindVar('')).toBe('var(--accent)')
  })

  it('tipo próprio com nome de método do JavaScript cai no losango, sem quebrar o desenho', () => {
    for (const kind of ['constructor', 'toString', '__proto__', 'Navio']) {
      const html = renderToStaticMarkup(createElement(KindPortrait, { kind, name: 'Ana' }))
      expect(html).toContain('d="M30 8L52 30L30 52L8 30Z"')
    }
    expect(renderToStaticMarkup(createElement(KindPortrait, { kind: 'personagem', name: 'Ana' }))).not.toContain('M30 8L52 30L30 52L8 30Z')
  })
})
