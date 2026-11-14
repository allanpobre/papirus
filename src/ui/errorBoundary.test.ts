import { describe, expect, it } from 'vitest'
import { ErrorBoundary, errorDetails } from './ErrorBoundary'

describe('erro numa parte da tela', () => {
  it('os detalhes copiados trazem o aviso, o lugar, a mensagem e o começo do rastro', () => {
    const e = new Error('Falhou ao abrir')
    e.stack = ['Error: Falhou ao abrir', ...Array.from({ length: 20 }, (_, i) => `    at passo${i}`)].join('\n')
    const t = errorDetails(e, 'Esta parte deu erro', '/app/')
    expect(t).toContain('Esta parte deu erro')
    expect(t).toContain('Onde: /app/')
    expect(t).toContain('Erro: Falhou ao abrir')
    expect(t).toContain('at passo6')
    // Só o começo do rastro (8 linhas), para a mensagem não ficar enorme.
    expect(t).not.toContain('at passo15')
  })

  it('guarda o erro e começa sem "copiado"', () => {
    const e = new Error('x')
    expect(ErrorBoundary.getDerivedStateFromError(e)).toEqual({ error: e, copied: false })
  })
})
