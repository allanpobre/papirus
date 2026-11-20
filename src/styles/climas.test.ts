import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Auditoria 17: no clima Terror (escuro) o vermelho do texto e o botão cheio ficavam abaixo de 4,5:1.
const css = readFileSync(new URL('./climas.css', import.meta.url), 'utf8')

const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}
const terrorBlock = /body\[data-clima='terror'\] \{[^}]*--accent:[^}]*\}/.exec(css)![0]
const token = (name: string) => new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(terrorBlock)![1]!

describe('clima Terror (escuro): contraste', () => {
  it('o texto de destaque passa de 4,5:1 sobre o fundo e sobre o painel', () => {
    expect(ratio(token('accent'), token('bg'))).toBeGreaterThanOrEqual(4.5)
    expect(ratio(token('accent'), token('surface'))).toBeGreaterThanOrEqual(4.5)
  })
  it('o texto do botão cheio passa de 4,5:1 sobre o vermelho do botão', () => {
    const fill = /terror'\]:not\(\[data-clima-modo='claro'\]\) \.btn-primary \{\s*background:\s*(#[0-9a-fA-F]{6})/.exec(css)![1]!
    expect(ratio(token('accent-ink'), fill)).toBeGreaterThanOrEqual(4.5)
  })
})
