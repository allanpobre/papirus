import { describe, expect, it } from 'vitest'
import { readerBook, readerEntities } from '../logic/reader'
import { revealIndex, splitReveals } from '../logic/reveals'
import { scenesOf } from './universe'
import { universeSchema } from './schema'
import { isOutdatedSample, isSample, sampleUniverse } from './sample'
import { ostriaUniverse } from './sampleOstria'

describe('exemplo: O Alienista', () => {
  it('traz os treze capítulos inteiros', async () => {
    const u = await sampleUniverse()
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
    const u = await sampleUniverse()
    const order = scenesOf(u, u.stories[0].id)
    const texts = u.entities.flatMap((e) => [e.description, ...e.fields.map((f) => f.value)])
    const parts = texts.flatMap(splitReveals).filter((p) => p.sceneTitle !== null)
    expect(parts.length).toBeGreaterThan(10)
    for (const p of parts) expect(revealIndex(p, order), p.sceneTitle ?? '').not.toBeNull()
    const ids = new Set(order.map((s) => s.id))
    for (const r of u.relations) for (const id of r.scope.sceneIds) expect(ids.has(id)).toBe(true)
  })

  it('para o leitor, quem aparece depois não está no caderno do começo', async () => {
    const u = await sampleUniverse()
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
    expect(isSample(await sampleUniverse())).toBe(true)
    expect(isOutdatedSample(await sampleUniverse())).toBe(false)
  })
})
