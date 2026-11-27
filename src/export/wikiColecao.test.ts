import { describe, expect, it } from 'vitest'
import { ostriaUniverse } from '../model/sampleOstria'
import { buildWiki } from './wiki'

describe('wiki por coleção', () => {
  const base = ostriaUniverse()
  // Ostria tem uma história só: cria uma segunda, com uma cena que só tem a Brisa; a coleção "Malkai" é a segunda.
  const first = base.stories[0]
  const segunda = { ...first, id: 'hist-2', title: 'Pequeno General' }
  const sceneBase = base.scenes[0]
  const kael = base.entities.find((e) => e.name === 'Kael')!
  const cena = { ...sceneBase, id: 'cena-malkai', storyId: segunda.id, title: 'Outro lado', text: 'x', presentIds: [kael.id], povId: kael.id, placeId: null }
  const u = {
    ...base,
    collections: [
      { id: 'c-pap', name: 'Papilio' },
      { id: 'c-mal', name: 'Malkai', parentId: 'c-pap' },
    ],
    stories: [{ ...first, collectionId: 'c-pap' }, { ...segunda, collectionId: 'c-mal' }],
    scenes: [...base.scenes.map((s) => ({ ...s, storyId: first.id })), cena],
  }
  const nomesDe = (collectionId?: string) => buildWiki({ ...u, settings: { ...u.settings, wiki: collectionId ? { collectionId } : undefined } }, { upTo: null }).data.fichas.filter((f) => f.tipo === 'Personagem').map((f) => f.nome)

  // (A wiki nunca leva ficha secreta: o mundo todo é a lista sem coleção, não todas as fichas.)
  it('sem coleção, é o mundo todo', () => {
    expect(nomesDe().length).toBeGreaterThan(3)
  })

  it('só o Malkai: entra quem aparece nele (Kael, que também está no outro lado) e o pano de fundo, não quem é só do outro livro', () => {
    const malkai = nomesDe('c-mal')
    expect(malkai).toContain('Kael')
    expect(malkai.length).toBeLessThan(nomesDe().length)
  })

  it('o Papilio traz os livros dos dois lados (o Malkai está dentro dele)', () => {
    expect(nomesDe('c-pap')).toEqual(nomesDe())
  })

  it('ligações e fatos não citam quem ficou de fora da coleção', () => {
    const fora = nomesDe().filter((n) => !nomesDe('c-mal').includes(n))
    expect(fora.length).toBeGreaterThan(0)
    const { data } = buildWiki({ ...u, settings: { ...u.settings, wiki: { collectionId: 'c-mal' } } }, { upTo: null })
    const textos = data.fichas.flatMap((f) => [...f.ligacoes, ...f.fatos]).join(' | ')
    for (const n of fora) expect(textos).not.toContain(n)
  })

  it('o título e o recorte dizem de qual coleção é', () => {
    const { data } = buildWiki({ ...u, settings: { ...u.settings, wiki: { collectionId: 'c-mal' } } }, { upTo: null })
    expect(data.mundo.nome).toContain('Malkai')
    expect(data.recorte).toContain('Malkai')
  })
})
