import { describe, expect, it } from 'vitest'
import { sampleUniverse } from '../model/sample'
import { draftFact, draftRevelation, insert, patch } from '../model/universe'
import { playerLink, readPlayerLink } from './server'
import { codexSnapshot, isEmptySnapshot, sameContent } from './snapshot'

const u = sampleUniverse()
const group = u.groups[0]
const find = (name: string) => u.entities.find((e) => e.name === name)!

describe('retrato do Codex para os jogadores', () => {
  it('leva só o revelado, sem segredos e sem rótulo de mentira', () => {
    const ostria = find('Ostria')
    let v = patch(u, 'entities', ostria.id, { description: 'Cidade portuária. [segredo]O porto é dos contrabandistas.[/segredo]' })
    let lie
    ;[v, lie] = insert(v, 'facts', draftFact({ subjectId: find('Kael').id, predicate: 'é filho de', value: 'um pescador', speakerId: find('Mira').id, canon: 'falso' }))
    ;[v] = insert(v, 'revelations', draftRevelation(group.id, 'fato', lie.id, null))
    const snap = codexSnapshot(v, group.id)
    const json = JSON.stringify(snap)
    expect(json).toContain('Cidade portuária.')
    expect(json).not.toContain('contrabandistas')
    expect(json).not.toMatch(/falso/i)
    expect(snap.facts).toContainEqual({ text: 'Kael é filho de um pescador', tag: 'segundo Mira' })
    // Nada que não foi revelado: Ilsa não está no Codex da mesa.
    expect(json).not.toContain('Ilsa')
    const vaelor = snap.sections.flatMap((s) => s.entries).find((e) => e.name === 'Vaelor')
    expect(vaelor).toMatchObject({ depth: 'nome', summary: '', description: '' })
  })

  it('compara conteúdo ignorando a hora', () => {
    const a = codexSnapshot(u, group.id)
    const b = { ...codexSnapshot(u, group.id), at: '2000-01-01T00:00:00Z' }
    expect(sameContent(a, b)).toBe(true)
    expect(isEmptySnapshot(codexSnapshot(u, 'outra-mesa'))).toBe(true)
  })
})

describe('link dos jogadores', () => {
  it('leva o id e o servidor, e volta igual', () => {
    const server = { url: 'https://abc.supabase.co', anonKey: 'eyJ.chave-publica' }
    const id = '6f1c2d3e-4b5a-4c6d-8e9f-0a1b2c3d4e5f'
    const link = playerLink('https://exemplo.github.io/papirus/', server, id)
    expect(link.startsWith('https://exemplo.github.io/papirus/app/?mesa=' + id)).toBe(true)
    expect(playerLink('https://exemplo.github.io/papirus/app/', server, id)).toBe(link)
    expect(readPlayerLink(new URL(link).search)).toEqual({ id, server })
    expect(readPlayerLink('?mesa=nao-e-um-id')).toBeNull()
    expect(readPlayerLink('')).toBeNull()
  })
})
