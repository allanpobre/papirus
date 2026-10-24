import { describe, expect, it } from 'vitest'
import { applyTemplate } from './templates'
import { createUniverse, draftEntity, insert } from './universe'

describe('modelos de universo', () => {
  it('fantasia: calendário, Livro I com a primeira cena e campos sugeridos nas fichas novas', () => {
    const u = applyTemplate(createUniverse('Eldra'), 'fantasia')
    expect(u.settings.calendarMonths).toHaveLength(12)
    expect(u.stories.map((s) => s.title)).toEqual(['Livro I'])
    expect(u.scenes).toHaveLength(1)
    const [, kael] = insert(u, 'entities', draftEntity('personagem', 'Kael'))
    expect(kael.fields.map((f) => f.key)).toEqual(['Idade', 'Aparência', 'Objetivo', 'Medo', 'Segredo'])
    expect(kael.fields.every((f) => f.value === '')).toBe(true)
    // Tipo sem modelo: sem campos.
    const [, x] = insert(u, 'entities', draftEntity('conceito', 'Maré'))
    expect(x.fields).toEqual([])
  })

  it('campanha de RPG: mesa, sistema, sessão 1 e tabela', () => {
    const u = applyTemplate(createUniverse('Mesa'), 'rpg')
    expect(u.groups).toHaveLength(1)
    expect(u.systems).toHaveLength(1)
    expect(u.sessions[0].groupId).toBe(u.groups[0].id)
    expect(u.tables[0].entries.length).toBeGreaterThan(2)
  })

  it('em branco não muda nada; nada é escrito pelo autor', () => {
    const base = createUniverse('Nada')
    expect(applyTemplate(base, 'branco')).toBe(base)
    for (const id of ['fantasia', 'ficcao', 'misterio', 'realista', 'rpg'] as const) {
      expect(applyTemplate(createUniverse('X'), id).scenes.every((s) => !s.text.trim())).toBe(true)
    }
  })
})
