import { describe, expect, it } from 'vitest'
import { readerBook, readerEntities } from '../logic/reader'
import { revealIndex, splitReveals } from '../logic/reveals'
import { scenesOf } from './universe'
import { universeSchema } from './schema'
import { alienistaUniverse, isOutdatedSample, isSample, sampleFor, sampleKindOf, sampleUniverse } from './sample'
import { whoIs } from '../logic/definers'
import { ostriaUniverse } from './sampleOstria'

describe('exemplo: O Alienista (o segundo)', () => {
  it('traz os treze capítulos inteiros', async () => {
    const u = await alienistaUniverse()
    expect(universeSchema.safeParse(u).success).toBe(true)
    const scenes = scenesOf(u, u.stories[0].id)
    expect(scenes.map((s) => s.title)).toHaveLength(13)
    expect(scenes[0].title).toBe('De como Itaguaí ganhou uma casa de orates')
    expect(scenes[12].title).toBe('Plus ultra!')
    const words = scenes.reduce((n, s) => n + s.text.split(/\s+/).length, 0)
    expect(words).toBeGreaterThan(15000)
    // Grafia de hoje.
    const all = scenes.map((s) => s.text).join(' ')
    for (const old of [' elle ', 'sciencia', 'Itaguahy', ' delle', 'theoria', 'medico ']) expect(all).not.toContain(old)
    expect(all).toContain('A ciência, disse ele a Sua Majestade')
    // Itálico vira marca no texto do editor.
    expect(JSON.stringify(scenes[12].doc)).toContain('"text":"Plus ultra!","marks":[{"type":"italic"}]')
  })

  it('toda revelação aponta para um capítulo que existe, e tudo que muda por cena usa cenas do livro', async () => {
    const u = await alienistaUniverse()
    const order = scenesOf(u, u.stories[0].id)
    const texts = u.entities.flatMap((e) => [e.description, ...e.fields.map((f) => f.value)])
    const parts = texts.flatMap(splitReveals).filter((p) => p.sceneTitle !== null)
    expect(parts.length).toBeGreaterThan(10)
    for (const p of parts) expect(revealIndex(p, order), p.sceneTitle ?? '').not.toBeNull()
    const ids = new Set(order.map((s) => s.id))
    for (const r of u.relations) for (const id of r.scope.sceneIds) expect(ids.has(id)).toBe(true)
  })

  it('para o leitor, quem aparece depois não está no caderno do começo', async () => {
    const u = await alienistaUniverse()
    const book = readerBook(u)
    const names = (i: number) => readerEntities(book, i).map((e) => e.entity.name)
    expect(names(0)).toContain('Simão Bacamarte')
    expect(names(0)).not.toContain('Porfírio')
    expect(names(5)).toContain('Porfírio')
  })

  it('o exemplo antigo é reconhecido e trocado pelo novo', async () => {
    const old = { ...ostriaUniverse(), description: 'Universo de exemplo. Um reino em ruínas, um estranho de rosto pálido, um regente com medo e uma herdeira que não sabe quem é.' }
    expect(isOutdatedSample(old)).toBe(true)
    // O de fantasia dos testes é exemplo, mas não é trocado.
    expect(isSample(ostriaUniverse())).toBe(true)
    expect(isOutdatedSample(ostriaUniverse())).toBe(false)
    expect(isSample(await alienistaUniverse())).toBe(true)
    expect(isOutdatedSample(await alienistaUniverse())).toBe(false)
  })
})

describe('exemplo principal: a Terra de Oz', () => {
  it('traz os vinte e quatro capítulos inteiros, e o endereço abre cada exemplo', async () => {
    const u = await sampleUniverse()
    expect(universeSchema.safeParse(u).success).toBe(true)
    const scenes = scenesOf(u, u.stories[0].id)
    expect(scenes).toHaveLength(24)
    expect(scenes[0].title).toBe('O ciclone')
    expect(scenes[23].title).toBe('De volta para casa')
    expect(scenes.reduce((n, s) => n + s.text.split(/\s+/).length, 0)).toBeGreaterThan(35000)
    const all = scenes.map((s) => s.text).join(' ')
    // Só o livro: sapatos de prata, nada do filme.
    expect(all).toContain('sapatos de prata')
    expect(all).not.toMatch(/rubi.{0,20}sapat|sapat.{0,20}rubi/i)
    expect(sampleKindOf(u)).toBe('oz')
    expect(sampleKindOf(await sampleFor('alienista'))).toBe('alienista')
    expect(sampleKindOf(await sampleFor(null))).toBe('oz')
  })

  it('revelações e ligações por cena apontam para capítulos que existem', async () => {
    const u = await sampleUniverse()
    const order = scenesOf(u, u.stories[0].id)
    const parts = u.entities.flatMap((e) => [e.description, ...e.fields.map((f) => f.value)]).flatMap(splitReveals).filter((p) => p.sceneTitle !== null)
    expect(parts.length).toBeGreaterThan(10)
    for (const p of parts) expect(revealIndex(p, order), p.sceneTitle ?? '').not.toBeNull()
    const ids = new Set(order.map((s) => s.id))
    for (const r of u.relations) for (const id of r.scope.sceneIds) expect(ids.has(id)).toBe(true)
    for (const f of u.facts) if (f.sourceSceneId && f.quote) expect(order.find((s) => s.id === f.sourceSceneId)?.text, f.quote).toContain(f.quote)
  })

  it('mostra o mundo: quem é (com exceção), mapa político, segredo e o leitor sem spoiler', async () => {
    const u = await sampleUniverse()
    const byName = (n: string) => u.entities.find((e) => e.name === n)!
    const espantalho = whoIs(u, byName('Espantalho')).find((w) => w.definer.name === 'Feito de')!
    expect(espantalho.option?.name).toBe('Palha')
    expect(espantalho.traits.find((t) => t.key === 'Medo')?.value).toContain('fósforo')
    const lenhador = whoIs(u, byName('Lenhador de Lata')).find((w) => w.definer.name === 'Feito de')!
    expect(lenhador.traits.find((t) => t.key === 'Coração')?.exception).toContain('seda')
    expect(u.maps[0].regions).toHaveLength(4)
    expect(u.facts.some((f) => f.canon === 'secreto')).toBe(true)
    const book = readerBook(u)
    const names = (i: number) => readerEntities(book, i).map((e) => e.entity.name)
    expect(names(0)).toContain('Dorothy')
    expect(names(0)).not.toContain('Leão Covarde')
    expect(names(10)).toContain('Leão Covarde')
    expect(isSample(u)).toBe(true)
    expect(isOutdatedSample(u)).toBe(false)
  })
})
