import { describe, expect, it } from 'vitest'
import { sampleUniverse } from '../model/sample'
import { buildArchivistContext } from './archivistContext'

const u = sampleUniverse()

describe('contexto do Archivist', () => {
  it('inclui as fichas citadas na pergunta e seus vizinhos', () => {
    const ctx = buildArchivistContext(u, 'O que Ilsa guardava?', { includeSecrets: false, includeManuscript: false })
    expect(ctx.text).toContain('### Ilsa')
    expect(ctx.text).toContain('### Torre de Marfim')
    expect(ctx.text).toContain('Ilsa guardiã de Torre de Marfim')
    // Relação com ficha secreta não vaza.
    const kael = buildArchivistContext(u, 'Kael', { includeSecrets: false, includeManuscript: false })
    expect(kael.text).toContain('### Mira')
    expect(kael.text).not.toContain('### Vaelor')
    expect(kael.text).not.toContain('desconfia de Vaelor')
  })

  it('deixa segredos de fora, a menos que o autor peça', () => {
    const fechado = buildArchivistContext(u, 'Quem é Vaelor?', { includeSecrets: false, includeManuscript: false })
    expect(fechado.text).not.toContain('### Vaelor')
    expect(fechado.text).not.toContain('sobreviveu à')
    expect(fechado.hiddenSecrets).toBeGreaterThan(0)

    const aberto = buildArchivistContext(u, 'Quem é Vaelor?', { includeSecrets: true, includeManuscript: false })
    expect(aberto.text).toContain('### Vaelor')
    expect(aberto.text).toContain('Vaelor sobreviveu à Queda')
  })

  it('só envia texto do manuscrito quando pedido', () => {
    const sem = buildArchivistContext(u, 'Kael', { includeSecrets: false, includeManuscript: false })
    const com = buildArchivistContext(u, 'Kael', { includeSecrets: false, includeManuscript: true })
    expect(sem.text).not.toContain('## Trechos do manuscrito')
    expect(com.text).toContain('## Trechos do manuscrito')
    expect(com.text).toContain('Em “A chegada”')
  })
})
