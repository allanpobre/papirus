import { describe, expect, it } from 'vitest'
import { ostriaUniverse as sampleUniverse } from '../model/sampleOstria'
import { patch } from '../model/universe'
import { buildArchivistContext } from './archivistContext'
import { codexMarkdown } from './codex'
import { countSecrets, splitSecrets, stripSecrets, wrapSecret } from './secrets'

const text = 'Cidade portuária. [segredo]O rei está vivo sob a Torre.[/segredo] Mercado forte.\n\n[SEGREDO]Linha inteira secreta.[/SEGREDO]\n\nFim.'

describe('trechos secretos', () => {
  it('separa partes públicas e secretas', () => {
    expect(splitSecrets(text).filter((p) => p.secret).map((p) => p.text)).toEqual(['O rei está vivo sob a Torre.', 'Linha inteira secreta.'])
    expect(countSecrets(text)).toBe(2)
  })

  it('remove os segredos sem deixar buracos', () => {
    expect(stripSecrets(text)).toBe('Cidade portuária. Mercado forte.\n\nFim.')
  })

  it('envolve uma seleção com as marcações', () => {
    expect(wrapSecret('abc def', 4, 7)).toEqual({ text: 'abc [segredo]def[/segredo]', cursor: 26 })
    expect(wrapSecret('abc', 3, 3).text).toBe('abc[segredo][/segredo]')
  })

  it('o Codex nunca mostra trechos secretos, mesmo revelando a ficha inteira', () => {
    let u = sampleUniverse()
    const ostria = u.entities.find((e) => e.name === 'Ostria')!
    u = patch(u, 'entities', ostria.id, { description: text })
    const md = codexMarkdown(u, u.groups[0].id)
    expect(md).toContain('Mercado forte.')
    expect(md).not.toContain('rei está vivo')
    expect(md).not.toContain('[segredo]')
  })

  it('o Archivist só recebe segredos de trecho se o autor pedir', () => {
    let u = sampleUniverse()
    const ostria = u.entities.find((e) => e.name === 'Ostria')!
    u = patch(u, 'entities', ostria.id, { description: text })
    expect(buildArchivistContext(u, 'Ostria', { includeSecrets: false, includeManuscript: false }).text).not.toContain('rei está vivo')
    expect(buildArchivistContext(u, 'Ostria', { includeSecrets: true, includeManuscript: false }).text).toContain('rei está vivo')
  })
})
