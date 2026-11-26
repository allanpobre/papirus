import { strFromU8, unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { createUniverse, draftEntity, draftRelation, insert } from '../model/universe'
import { linkNames, obsidianVault } from './obsidian'

describe('obsidianVault', () => {
  it('uma pasta por tipo, uma nota por ficha, nomes virando [[ligações]] e as ligações no fim', () => {
    let u = createUniverse('Meu Mundo')
    const add = (kind: string, name: string, description = '') => {
      const [n, e] = insert(u, 'entities', { ...draftEntity(kind, name), description })
      u = n
      return e
    }
    const kael = add('personagem', 'Kael', 'Irmão de Mira. Nasceu no Porto de Varn.')
    const mira = add('personagem', 'Mira')
    add('lugar', 'Porto de Varn')
    ;[u] = insert(u, 'relations', draftRelation(kael.id, mira.id, 'irmão de'))
    const files = unzipSync(obsidianVault(u))
    expect(Object.keys(files).sort()).toEqual(['Meu Mundo/Lugares/Porto de Varn.md', 'Meu Mundo/Personagens/Kael.md', 'Meu Mundo/Personagens/Mira.md'])
    const nota = strFromU8(files['Meu Mundo/Personagens/Kael.md'])
    expect(nota).toContain('tipo: personagem')
    expect(nota).toContain('# Kael')
    expect(nota).toContain('Irmão de [[Mira]]. Nasceu no [[Porto de Varn]].')
    expect(nota).toContain('## Ligações')
    expect(nota).toContain('- irmão de [[Mira]]')
  })
  it('não liga a própria ficha, nem refaz o que já é [[ligação]], nem pega pedaço de palavra', () => {
    const names = [{ name: 'Mira', file: 'Mira' }, { name: 'Kael', file: 'Kael' }]
    expect(linkNames('Kael viu [[Mira]] e Miranda.', names, 'Kael')).toBe('Kael viu [[Mira]] e Miranda.')
  })
})
