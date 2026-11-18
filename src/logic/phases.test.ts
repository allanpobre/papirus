import { describe, expect, it } from 'vitest'
import { ostriaUniverse } from '../model/sampleOstria'
import { manuscriptOrder } from '../model/universe'
import { compareAt, entityAt, phaseAt, phasesOf } from './phases'

describe('fases: a ficha muda ao longo da história', () => {
  const u = ostriaUniverse()
  const order = manuscriptOrder(u)
  const kael = u.entities.find((e) => e.name === 'Kael')!
  const at = (t: string) => order.findIndex((s) => s.title === t)
  const comFases = {
    ...kael,
    fields: [...kael.fields, { key: 'Posto', value: 'Contrabandista', type: 'texto' as const, ref: null }],
    phases: [
      { id: 'f2', sceneId: order[at('A maré volta')].id, name: 'Procurado', cause: 'Fugiu do porto.', nameNow: 'O Fugitivo', summary: '', image: null, fields: [{ key: 'Posto', value: 'Foragido' }] },
      { id: 'f1', sceneId: order[at('Duas portas')].id, name: 'Marcado', cause: 'Viu o regente.', nameNow: '', summary: 'Agora sabe demais.', image: null, fields: [{ key: 'Medo', value: 'O regente' }] },
      { id: 'sumiu', sceneId: 'cena-apagada', name: 'Perdida', cause: '', nameNow: '', summary: 'nunca', image: null, fields: [] },
    ],
  }

  it('as fases ficam na ordem da história, e a de cena apagada fica de fora', () => {
    expect(phasesOf(comFases, order).map((p) => p.phase.id)).toEqual(['f1', 'f2'])
    expect(phaseAt(comFases, at('A chegada'), order)).toBeNull()
    expect(phaseAt(comFases, at('Duas portas'), order)?.phase.id).toBe('f1')
  })

  it('num ponto, a ficha é a base mais as fases que já começaram (só o que cada uma muda)', () => {
    const inicio = entityAt(comFases, at('A chegada'), order)
    expect(inicio.summary).toBe(kael.summary)
    expect(inicio.fields.find((f) => f.key === 'Posto')?.value).toBe('Contrabandista')
    const meio = entityAt(comFases, at('Duas portas'), order)
    expect(meio.summary).toBe('Agora sabe demais.')
    expect(meio.fields.find((f) => f.key === 'Medo')?.value).toBe('O regente')
    expect(meio.fields.find((f) => f.key === 'Posto')?.value).toBe('Contrabandista')
    const fim = entityAt(comFases, order.length - 1, order)
    expect(fim.name).toBe('O Fugitivo')
    expect(fim.aliases).toContain('Kael')
    expect(fim.fields.find((f) => f.key === 'Posto')?.value).toBe('Foragido')
    // O que a fase de antes mudou continua valendo.
    expect(fim.summary).toBe('Agora sabe demais.')
    expect(fim.fields.find((f) => f.key === 'Medo')?.value).toBe('O regente')
    // Sem fases, a ficha é a mesma (o mesmo objeto).
    expect(entityAt(kael, order.length - 1, order)).toBe(kael)
  })

  it('comparar dois pontos mostra só o que mudou', () => {
    const diff = compareAt(comFases, at('A chegada'), order.length - 1, order)
    expect(diff.map((d) => d.key)).toEqual(expect.arrayContaining(['Nome', 'Resumo', 'Posto', 'Medo']))
    expect(diff.find((d) => d.key === 'Posto')).toMatchObject({ before: 'Contrabandista', after: 'Foragido' })
    expect(diff.find((d) => d.key === 'Medo')).toMatchObject({ before: '', after: 'O regente' })
    expect(compareAt(comFases, at('Duas portas'), at('Duas portas'), order)).toEqual([])
  })
})
