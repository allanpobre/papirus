import { describe, expect, it } from 'vitest'
import type { Sheet } from '../model/schema'
import { describeOutcome, expandFormula, modifier, resolveRoll, rollAttribute, rollInitiative, rollSkill } from './rolls'
import { adjustResource, draftSheet } from './sheets'
import { makeSystem, SYSTEM_TEMPLATES } from './systems'

const sheetOf = (system: ReturnType<typeof makeSystem>, changes: Partial<Sheet> = {}): Sheet => ({
  ...draftSheet('Teste', system),
  id: 's1',
  createdAt: '',
  updatedAt: '',
  ...changes,
})

const fixed = (values: number[]) => {
  let i = 0
  return () => values[i++ % values.length]
}
const attr = (sys: ReturnType<typeof makeSystem>, abbr: string) => sys.attributes.find((a) => a.abbr === abbr)!
const skill = (sys: ReturnType<typeof makeSystem>, name: string) => sys.skills.find((s) => s.name === name)!

describe('modelos de sistema', () => {
  it('todos os modelos criam sistemas com fórmulas que rolam', () => {
    for (const t of SYSTEM_TEMPLATES) {
      const sys = makeSystem(t.id)
      const sheet = sheetOf(sys)
      expect(() => rollInitiative(sys, sheet)).not.toThrow()
      for (const a of sys.attributes) expect(() => rollAttribute(sys, sheet, a.id)).not.toThrow()
      for (const s of sys.skills) expect(() => rollSkill(sys, sheet, s.id)).not.toThrow()
    }
  })

  it('cada criação gera IDs novos', () => {
    expect(makeSystem('d20-5e').attributes[0].id).not.toBe(makeSystem('d20-5e').attributes[0].id)
  })
})

describe('fórmulas', () => {
  it('estilo 5e: modificador = (valor - 10) / 2, arredondado para baixo', () => {
    const sys = makeSystem('d20-5e')
    expect([8, 9, 10, 15, 20].map((v) => modifier(sys, v))).toEqual([-1, -1, 0, 2, 5])
    const sheet = sheetOf(sys, { attributes: { [attr(sys, 'DES').id]: 16 }, skills: { [skill(sys, 'Furtividade').id]: 2 } })
    expect(expandFormula(sys.skillFormula, { system: sys, sheet, attributeId: attr(sys, 'DES').id, skillValue: 2 })).toBe('1d20+3+2')
    expect(expandFormula(sys.initiativeFormula, { system: sys, sheet })).toBe('1d20+3')
  })

  it('modificador negativo vira subtração', () => {
    const sys = makeSystem('d20-5e')
    const sheet = sheetOf(sys, { attributes: { [attr(sys, 'FOR').id]: 6 } })
    expect(expandFormula(sys.attributeFormula, { system: sys, sheet, attributeId: attr(sys, 'FOR').id })).toBe('1d20-2')
  })

  it('estilo Ordem Paranormal: atributo é quantidade de d20; zero rola 2 e fica o pior', () => {
    const sys = makeSystem('op')
    const agi = attr(sys, 'AGI').id
    const comTres = sheetOf(sys, { attributes: { [agi]: 3 } })
    expect(expandFormula(sys.attributeFormula, { system: sys, sheet: comTres, attributeId: agi })).toBe('3d20kh1')
    const semNada = sheetOf(sys, { attributes: { [agi]: 0 } })
    expect(expandFormula(sys.attributeFormula, { system: sys, sheet: semNada, attributeId: agi })).toBe('2d20kl1')
    expect(expandFormula(sys.initiativeFormula, { system: sys, sheet: semNada })).toBe('2d20kl1+0')
  })

  it('perícia por nome e recursos por sigla', () => {
    const sys = makeSystem('t20')
    const sheet = sheetOf(sys, { skills: { [skill(sys, 'Iniciativa').id]: 4 }, attributes: { [attr(sys, 'DES').id]: 2 } })
    expect(expandFormula(sys.initiativeFormula, { system: sys, sheet })).toBe('1d20+2+4')
    expect(expandFormula('{PV}', { system: sys, sheet })).toBe('12')
  })
})

describe('leitura dos resultados', () => {
  it('parada de dados conta sucessos', () => {
    const sys = makeSystem('parada')
    const o = resolveRoll(sys, 'Teste', '4d10', undefined, fixed([0.75, 0.95, 0.1, 0.5]))
    expect(o.result.parts[0].rolls).toEqual([8, 10, 2, 6])
    expect(o.verdict).toBe('2 sucessos')
  })

  it('parada de dados sem perícia não quebra (0d10 vira 0)', () => {
    const sys = makeSystem('parada')
    const sheet = sheetOf(sys)
    const briga = skill(sys, 'Briga')
    expect(expandFormula(sys.skillFormula, { system: sys, sheet, attributeId: briga.attributeId, skillValue: 0 })).toBe('2d10+0')
  })

  it('d100: compara com a perícia e mostra o grau', () => {
    const sys = makeSystem('d100')
    const sheet = sheetOf(sys, { skills: { [skill(sys, 'Encontrar').id]: 60 } })
    const at = (n: number) => rollSkill(sys, sheet, skill(sys, 'Encontrar').id, fixed([(n - 1) / 100])).verdict
    expect(at(1)).toBe('Crítico')
    expect(at(12)).toBe('Sucesso extremo')
    expect(at(30)).toBe('Sucesso difícil')
    expect(at(60)).toBe('Sucesso')
    expect(at(61)).toBe('Falha')
    expect(at(100)).toBe('Desastre')
  })

  it('d20: destaca 20 e 1 naturais e descreve para o registro', () => {
    const sys = makeSystem('d20-5e')
    const o = resolveRoll(sys, 'Ataque', '1d20+5', undefined, fixed([0.99]))
    expect(o.verdict).toBe('20 natural')
    expect(describeOutcome(o, 'Kael')).toBe('Kael — Ataque: 25 (20 natural) · 1d20+5 [20]')
  })
})

describe('recursos', () => {
  it('dano e cura respeitam o máximo', () => {
    const sys = makeSystem('d20-5e')
    const pv = sys.resources[0].id
    const sheet = sheetOf(sys)
    expect(adjustResource(sheet, pv, -4)[pv]).toEqual({ current: 6, max: 10 })
    expect(adjustResource(sheet, pv, 50)[pv]).toEqual({ current: 10, max: 10 })
  })
})
