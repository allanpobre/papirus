import { describe, expect, it } from 'vitest'
import { ostriaUniverse } from '../model/sampleOstria'
import { buildWiki } from './wiki'

describe('wiki do mundo', () => {
  it('tudo, menos os segredos', () => {
    const { html } = buildWiki(ostriaUniverse(), { upTo: null })
    expect(html).toContain('<h2>Kael</h2>')
    expect(html).toContain('Tem os mesmos olhos cinzentos do retrato')
    // Segredos nunca vão: a ficha secreta, o trecho [segredo] e o fato secreto.
    expect(html).not.toContain('<h2>Vaelor</h2>')
    expect(html).not.toContain('É Vaelor.')
    expect(html).not.toContain('mandou incendiar')
    // Nomes de outras fichas viram links.
    expect(html).toMatch(/<a href="#f-[^"]+">Mira<\/a>/)
  })

  it('até uma cena: sem spoiler', () => {
    const { html, entries } = buildWiki(ostriaUniverse(), { upTo: 0 })
    expect(html).toContain('até “A chegada”')
    expect(html).not.toContain('Tem os mesmos olhos cinzentos do retrato')
    expect(html).not.toContain('<h2>Cassian</h2>')
    expect(entries).toBeLessThan(buildWiki(ostriaUniverse(), { upTo: null }).entries)
  })
})
