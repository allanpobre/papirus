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

describe('wiki navegável', () => {
  it('abre numa capa com cartões, cada ficha com "Citado em" e vizinhas', () => {
    const { html } = buildWiki(ostriaUniverse(), { upTo: null })
    expect(html).toContain('<section class="page" id="inicio">')
    expect(html).toMatch(/<a class="card" href="#f-[^"]+">/)
    expect(html).toContain('<h3>Citado em</h3>')
    expect(html).toContain('class="pager"')
    expect(html).toContain('id="menu"')
  })

  it('leva os mapas com marcadores só de fichas que podem ser vistas', () => {
    const ref = `img:${'d'.repeat(32)}`
    let [u, mira] = insert(createUniverse('W'), 'entities', draftEntity('personagem', 'Mira'))
    ;[u] = insert(u, 'entities', { ...draftEntity('personagem', 'Oculto'), canon: 'secreto' })
    const oculto = u.entities.find((e) => e.name === 'Oculto')!
    const now = new Date().toISOString()
    const pins = [
      { id: 'p1', entityId: mira.id, x: 0.25, y: 0.5, label: 'Mira' },
      { id: 'p2', entityId: oculto.id, x: 0.7, y: 0.2, label: 'Oculto' },
    ]
    u = { ...u, maps: [{ id: 'm1', name: 'Costa', image: ref, width: 10, height: 10, pins, createdAt: now, updatedAt: now }] }
    const { html } = buildWiki(u, { upTo: null, images: new Map([[ref, 'data:image/webp;base64,BBBB']]) })
    expect(html).toContain('id="mapas"')
    expect(html).toContain('left:25.00%;top:50.00%')
    expect(html).not.toContain('Oculto')
    expect(html).toContain('No mapa: <a href="#mapas">Costa</a>')
    // Sem a imagem pronta, o mapa fica de fora.
    expect(buildWiki(u, { upTo: null }).html).not.toContain('id="mapas"')
  })
})

describe('wiki em texto e em dados', () => {
  it('Markdown e JSON levam o mesmo recorte, sem segredos', async () => {
    const { wikiMarkdown } = await import('./wiki')
    const { data } = buildWiki(ostriaUniverse(), { upTo: null })
    const md = wikiMarkdown(data)
    expect(md).toMatch(/^# /)
    expect(md).toContain('### Kael')
    expect(md).toContain('**Citado em:**')
    expect(md).not.toContain('### Vaelor')
    expect(md).not.toContain('mandou incendiar')
    expect(data.formato).toBe('papirus-wiki')
    expect(data.fichas.find((f) => f.nome === 'Kael')?.citadoEm).toContain('Mira')
    expect(JSON.stringify(data)).not.toContain('mandou incendiar')
    const early = buildWiki(ostriaUniverse(), { upTo: 0 }).data
    expect(early.fichas.length).toBeLessThan(data.fichas.length)
    expect(wikiMarkdown(early)).not.toContain('### Cassian')
  })
})

describe('frases das ligações', () => {
  it('põe "é" antes de um papel, e não antes de um verbo', async () => {
    const { relationVerb } = await import('../logic/relations')
    expect(relationVerb('irmão de')).toBe('é irmão de')
    expect(relationVerb('Aliado de')).toBe('é Aliado de')
    expect(relationVerb('governa')).toBe('governa')
    expect(relationVerb('desconfia de')).toBe('desconfia de')
    expect(buildWiki(ostriaUniverse(), { upTo: null }).html).toContain('Kael é irmão de')
  })
})

describe('wiki personalizada', () => {
  it('respeita título, autor, tipos e fichas de fora, campos escondidos, seções, cor e letra', () => {
    const base = ostriaUniverse()
    const kael = base.entities.find((e) => e.name === 'Kael')!
    const u = {
      ...base,
      entities: base.entities.map((e) => (e.name === 'Mira' ? { ...e, wikiHidden: true } : e)),
      settings: {
        ...base.settings,
        wiki: { title: 'Ostria para jogadores', author: 'Ana', hiddenKinds: ['religiao'], hiddenFields: [kael.fields[0]?.key ?? 'x'], timeline: false, cites: false, color: '#123456', font: 'sem-serifa' as const },
      },
    }
    const { html, data } = buildWiki(u, { upTo: null })
    expect(html).toContain('<h1>Ostria para jogadores</h1>')
    expect(html).toContain('por Ana')
    expect(html).not.toContain('<h2>Mira</h2>')
    expect(html).not.toContain('<h2>Fé da Maré</h2>')
    expect(html).not.toContain('id="linha-do-tempo"')
    expect(html).not.toContain('<h3>Citado em</h3>')
    expect(html).toContain('--tone:#123456')
    expect(html).toContain('--font:system-ui')
    if (kael.fields[0]) expect(data.fichas.find((f) => f.nome === 'Kael')!.campos.map((c) => c.nome)).not.toContain(kael.fields[0].key)
    expect(data.mundo).toMatchObject({ nome: 'Ostria para jogadores', autor: 'Ana' })
  })
})

describe('lendas e documentos', () => {
  it('saem como documento na wiki, no grupo próprio', () => {
    const [u] = insert(createUniverse('W'), 'entities', { ...draftEntity('documento', 'A Canção do Farol'), description: 'Quando a névoa sobe, o farol canta.' })
    const { html } = buildWiki(u, { upTo: null })
    expect(html).toContain('<div class="doc-text"><p>Quando a névoa sobe, o farol canta.</p></div>')
    expect(html).toContain('Lendas e documentos')
  })
})
