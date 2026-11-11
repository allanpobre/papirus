import { strToU8, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { createUniverse, draftEntity, insert } from '../model/universe'
import { applyForeign, kindFrom, plainText, readForeign, unzipText } from './foreignWorld'

describe('trazer de outros apps', () => {
  it('Obsidian: cabeçalho YAML, pasta como tipo, [[ligações]] viram texto', () => {
    const w = readForeign([
      {
        path: 'Mundo/Personagens/Kael.md',
        text: '---\naliases: [O Contrabandista]\ntags:\n  - porto\n---\n# Kael\n\nContrabandista do porto. Irmão de [[Mira|a herdeira]].\n\nConhece cada beco de [[Porto Velho]].\n',
      },
      { path: 'Mundo/Lugares/Porto Velho.md', text: 'O porto mais antigo da costa.' },
      { path: 'Mundo/.obsidian/app.json', text: '{}' },
    ])
    expect(w.sources).toEqual(['Obsidian (Markdown)'])
    const kael = w.entities.find((e) => e.name === 'Kael')!
    expect(kael).toMatchObject({ kind: 'personagem', aliases: ['O Contrabandista'], tags: ['porto'], summary: 'Contrabandista do porto.' })
    expect(kael.description).toContain('Irmão de a herdeira.')
    expect(kael.description).toContain('cada beco de Porto Velho')
    expect(w.entities.find((e) => e.name === 'Porto Velho')!.kind).toBe('lugar')
  })

  it('Kanka (HTML, pasta) e World Anvil (BBCode, classe)', () => {
    const w = readForeign([
      { path: 'kanka/characters/1.json', text: JSON.stringify({ name: 'Aldric', entry: '<p>Rei de <b>Valmar</b>.</p><p>Velho.</p>', is_private: false }) },
      { path: 'wa/articles/2.json', text: JSON.stringify({ title: 'Elfos', entityClass: 'Species', content: '[h1]Origem[/h1]Vieram do mar. @[Valmar](location:9) os teme.' }) },
    ])
    expect(w.sources.sort()).toEqual(['Kanka', 'World Anvil'])
    expect(w.entities.find((e) => e.name === 'Aldric')).toMatchObject({ kind: 'personagem', summary: 'Rei de Valmar.' })
    const elfos = w.entities.find((e) => e.name === 'Elfos')!
    expect(elfos.kind).toBe('especie')
    expect(elfos.description).toContain('Valmar os teme')
  })

  it('zip, tipos e texto limpo', () => {
    const zip = zipSync({ 'notas/Lendas/A Canção.md': strToU8('Quando a névoa sobe.'), 'img.png': new Uint8Array([1]) })
    const files = unzipText('cofre.zip', zip)
    expect(files.map((f) => f.path)).toEqual(['cofre/notas/Lendas/A Canção.md'])
    expect(readForeign(files).entities[0].kind).toBe('documento')
    expect(kindFrom('Organization')).toBe('faccao')
    expect(kindFrom(undefined, 'qualquer')).toBe('conceito')
    expect(plainText('<p>a &amp; b</p>')).toBe('a & b')
  })

  it('não repete fichas que já existem', () => {
    const [u] = insert(createUniverse('W'), 'entities', draftEntity('personagem', 'Kael'))
    const w = readForeign([
      { path: 'Kael.md', text: 'Outro Kael.' },
      { path: 'Mira.md', text: 'A herdeira.' },
    ])
    const out = applyForeign(u, w)
    expect(out).toMatchObject({ created: 1, existing: 1 })
    expect(out.universe.entities.map((e) => e.name).sort()).toEqual(['Kael', 'Mira'])
  })
})
