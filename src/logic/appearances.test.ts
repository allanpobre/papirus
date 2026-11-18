import { describe, expect, it } from 'vitest'
import { ostriaUniverse } from '../model/sampleOstria'
import { appearancesOf, presenceStrip, snippetParts } from './appearances'

describe('"Aparece em"', () => {
  it('o trecho marca o nome (e as outras menções dentro dele) e não corta palavras', () => {
    const text = 'No porto, Kael esperava. Mira olhou para Kael e não disse nada sobre a maré daquela noite.'
    const hits = [
      { from: text.indexOf('Kael'), to: text.indexOf('Kael') + 4 },
      { from: text.lastIndexOf('Kael'), to: text.lastIndexOf('Kael') + 4 },
    ]
    const parts = snippetParts(text, hits, 0, 40)
    expect(parts.filter((p) => p.mark).map((p) => p.text)).toEqual(['Kael', 'Kael'])
    const joined = parts.map((p) => p.text).join('')
    expect(joined.startsWith('No porto')).toBe(true)
    expect(joined.endsWith('…')).toBe(true)
    // Nenhum pedaço começa ou termina no meio de uma palavra cortada.
    expect(joined).not.toMatch(/…[a-zà-ú]/i)
    expect(snippetParts(text, [], 0)).toEqual([])
  })

  it('cada cena guarda o papel da ficha (o mais forte primeiro) e a tira mostra todas as cenas, na ordem, por livro', () => {
    const u = ostriaUniverse()
    const kael = u.entities.find((e) => e.name === 'Kael')!
    const list = appearancesOf(u, kael)
    expect(list.length).toBeGreaterThan(0)
    for (const a of list) expect(['pov', 'presente', 'local', 'mencionado']).toContain(a.roles[0])
    expect(list.some((a) => a.roles.includes('pov'))).toBe(true)
    const strip = presenceStrip(u, list)
    expect(strip.reduce((n, g) => n + g.dots.length, 0)).toBe(u.scenes.length)
    expect(strip.flatMap((g) => g.dots).filter((d) => d.role).length).toBe(list.length)
    expect(strip[0].title).toBe(u.stories[0].title)
  })
})
