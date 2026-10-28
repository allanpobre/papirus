import { describe, expect, it } from 'vitest'
import { ostriaUniverse } from '../model/sampleOstria'
import { createUniverse, draftEntity, insert } from '../model/universe'
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

describe('wiki com retratos', () => {
  it('põe o retrato da ficha dentro do arquivo quando a imagem está pronta', () => {
    const ref = `img:${'c'.repeat(32)}`
    const [u] = insert(createUniverse('W'), 'entities', { ...draftEntity('personagem', 'Mira'), image: ref })
    const { html } = buildWiki(u, { upTo: null, images: new Map([[ref, 'data:image/webp;base64,AAAA']]) })
    expect(html).toContain('<img class="portrait" src="data:image/webp;base64,AAAA"')
    expect(buildWiki(u, { upTo: null }).html).not.toContain('class="portrait"')
  })
})
