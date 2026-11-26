import { describe, expect, it } from 'vitest'
import { buildWiki } from '../export/wiki'
import { readerCopy } from '../share/readerCopy'
import { sampleUniverse } from './sample'

// O exemplo de Oz com as oficinas (cultura, crença, tensões, rotas): a wiki e o leitor mostram o que é do mundo
// e nunca o que é segredo.
describe('Oz: wiki e leitor com as oficinas', async () => {
  const oz = await sampleUniverse()
  const { html } = buildWiki(oz, { upTo: null, images: new Map() })
  const text = html.replace(/<[^>]+>/g, ' ')

  it('a wiki tem a crença, a cultura, a festa e a língua', () => {
    expect(text).toContain('O respeito às Bruxas')
    expect(text).toContain('Munchkins')
    expect(text).toContain('Festa da libertação')
    expect(text).toContain('Boq')
  })

  it('nada secreto sai na wiki nem no leitor', () => {
    const secrets = oz.entities.filter((e) => e.canon === 'secreto').map((e) => e.name)
    const secretRels = oz.relations.filter((r) => r.canon === 'secreto')
    expect(secrets.length + secretRels.length).toBeGreaterThan(0)
    for (const name of secrets) expect(text).not.toContain(name)
    const reader = readerCopy(oz, false)
    expect(reader.entities.some((e) => e.canon === 'secreto')).toBe(false)
    expect(reader.relations.some((r) => r.canon === 'secreto')).toBe(false)
    for (const s of reader.scenes) expect(s.text).not.toMatch(/\[segredo\]/i)
  })
})
