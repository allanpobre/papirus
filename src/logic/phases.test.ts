import { describe, expect, it } from 'vitest'
import { ostriaUniverse } from '../model/sampleOstria'
import { manuscriptOrder } from '../model/universe'
import { compareAt, entityAt, phaseAt, phasesOf, plannedOf, previewPlanned } from './phases'

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

describe('fases planejadas (ainda sem cena)', () => {
  const u = ostriaUniverse()
  const order = manuscriptOrder(u)
  const kael = u.entities.find((e) => e.name === 'Kael')!
  const planejada = { id: 'p1', sceneId: null, when: 'Livro 2', name: 'Rei do porto', cause: 'Toma o trono.', nameNow: 'Kael I', summary: 'Governa o porto.', image: null, fields: [{ key: 'Posto', value: 'Rei' }] }
  const comPlano = { ...kael, phases: [planejada] }

  it('não valem em nenhum ponto da história', () => {
    expect(phasesOf(comPlano, order)).toEqual([])
    expect(entityAt(comPlano, order.length - 1, order).name).toBe('Kael')
  })
  it('aparecem como planejadas, e a de cena apagada também', () => {
    const apagada = { ...planejada, id: 'p2', sceneId: 'cena-que-sumiu' }
    expect(plannedOf({ phases: [planejada, apagada] }, order).map((p) => p.id)).toEqual(['p1', 'p2'])
  })
  it('mostram como a ficha ficaria a partir do fim da história', () => {
    const { changes } = previewPlanned(comPlano, planejada, order)
    expect(changes.find((c) => c.key === 'Nome')).toMatchObject({ before: 'Kael', after: 'Kael I' })
    expect(changes.find((c) => c.key === 'Posto')?.after).toBe('Rei')
  })
  it('um universo antigo com fase sem cena não quebra o esquema', () => {
    expect(comPlano.phases[0].sceneId).toBeNull()
  })
})
