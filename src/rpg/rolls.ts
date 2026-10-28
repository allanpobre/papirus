import { physicalRandom, roll, type DiceRoll } from '../logic/dice'
import { fold } from '../logic/text'
import type { GameSystem, Sheet } from '../model/schema'

/** Modificador de um atributo conforme a regra do sistema. */
export function modifier(system: GameSystem, value: number): number {
  switch (system.modifierRule) {
    case 'd20':
      return Math.floor((value - 10) / 2)
    case 'direto':
      return value
    case 'nenhum':
      return 0
  }
}

export interface FormulaContext {
  system: GameSystem
  sheet: Sheet | null
  /** Atributo da rolagem atual ({atr}, {mod}). */
  attributeId?: string | null
  /** Valor da perícia da rolagem atual ({per}). */
  skillValue?: number
}

const attrValue = (ctx: FormulaContext, id: string | null | undefined) => {
  if (!id) return 0
  const a = ctx.system.attributes.find((x) => x.id === id)
  return ctx.sheet?.attributes[id] ?? a?.default ?? 0
}

/**
 * Troca os marcadores de uma fórmula pelos números da ficha:
 * {atr} e {mod} (atributo da rolagem), {per} (perícia), {SIGLA} e {mod:SIGLA}
 * (qualquer atributo), {per:Nome} (qualquer perícia) e {SIGLA} de recurso (valor atual).
 */
export function expandFormula(formula: string, ctx: FormulaContext): string {
  const { system, sheet } = ctx
  const byAbbr = (abbr: string) => system.attributes.find((a) => fold(a.abbr) === fold(abbr))
  const out = formula.replace(/\{\s*(mod:|per:)?([^}]+?)\s*\}/g, (_m, prefix: string | undefined, key: string) => {
    const k = fold(key)
    if (!prefix && k === 'atr') return String(attrValue(ctx, ctx.attributeId))
    if (!prefix && k === 'mod') return String(modifier(system, attrValue(ctx, ctx.attributeId)))
    if (!prefix && k === 'per') return String(ctx.skillValue ?? 0)
    if (prefix === 'per:') {
      const skill = system.skills.find((s) => fold(s.name) === k)
      return String(skill ? (sheet?.skills[skill.id] ?? 0) : 0)
    }
    const attr = byAbbr(key)
    if (attr) {
      const v = attrValue(ctx, attr.id)
      return String(prefix === 'mod:' ? modifier(system, v) : v)
    }
    const res = system.resources.find((r) => fold(r.abbr) === k)
    if (res && !prefix) return String(sheet?.resources[res.id]?.current ?? res.default)
    return '0'
  })
  return normalize(out, system.zeroDiceRule)
}

/** Limpa sinais duplicados e trata quantidades de dados zero ou negativas. */
function normalize(expr: string, zeroDiceRule: boolean): string {
  let e = expr.replace(/\s+/g, '')
  e = e.replace(/\+-/g, '-').replace(/-\+/g, '-').replace(/--/g, '+').replace(/\+\+/g, '+')
  // "0d20kh1" ou "-1d20kh1": sem dados.
  e = e.replace(/(^|[+-])(-?\d+)d(\d+)(k[hl]\d+)?/g, (m, sign: string, count: string, sides: string) => {
    if (Number(count) > 0) return m
    return zeroDiceRule ? `${sign}2d${sides}kl1` : sign === '-' ? '-0' : `${sign}0`
  })
  e = e.replace(/^\+/, '')
  return e || '0'
}

export interface RollOutcome {
  label: string
  /** Nome da rolagem sem o alvo, e o alvo (sistemas "abaixo de"): para refazer a conta com o dado físico. */
  name?: string
  target?: number
  /** Rolado num dado físico (a pessoa disse o que saiu). */
  physical?: boolean
  /** Margem de crítico do d20 (ataques "19/x2"). */
  critFrom?: number
  expression: string
  result: DiceRoll
  /** Leitura do resultado conforme o sistema (ex.: "3 sucessos", "Sucesso difícil"). */
  verdict: string | null
  tone: 'neutro' | 'sucesso' | 'falha' | 'critico' | 'desastre'
}

/** Rola e interpreta o resultado segundo o modo do sistema. */
export function resolveRoll(system: GameSystem, label: string, expression: string, target?: number, random?: () => number, critFrom?: number): RollOutcome {
  return { ...readRoll(system, label, expression, target, random, critFrom), name: label, target, ...(critFrom && critFrom < 20 ? { critFrom } : {}) }
}

function readRoll(system: GameSystem, label: string, expression: string, target?: number, random?: () => number, critFrom = 20): RollOutcome {
  const result = roll(expression, random)
  if (system.resolution === 'sucessos') {
    const dice = result.parts.flatMap((p) => p.kept)
    const hits = dice.filter((d) => d >= system.successTarget).length
    return {
      label,
      expression: result.expression,
      result,
      verdict: hits === 0 ? 'Nenhum sucesso' : `${hits} ${hits === 1 ? 'sucesso' : 'sucessos'}`,
      tone: hits === 0 ? 'falha' : 'sucesso',
    }
  }
  if (system.resolution === 'abaixo' && target !== undefined) {
    const v = result.total
    let verdict: string
    let tone: RollOutcome['tone']
    if (v === 1) [verdict, tone] = ['Crítico', 'critico']
    else if (v >= 100 || (target < 50 && v >= 96)) [verdict, tone] = ['Desastre', 'desastre']
    else if (v <= Math.floor(target / 5)) [verdict, tone] = ['Sucesso extremo', 'critico']
    else if (v <= Math.floor(target / 2)) [verdict, tone] = ['Sucesso difícil', 'sucesso']
    else if (v <= target) [verdict, tone] = ['Sucesso', 'sucesso']
    else [verdict, tone] = ['Falha', 'falha']
    return { label: `${label} (${target})`, expression: result.expression, result, verdict, tone }
  }
  // Total: destaca 20 natural e 1 natural quando a rolagem tem um único d20 mantido.
  const d20 = result.parts.filter((p) => /d20/.test(p.label) && p.kept.length === 1)
  const natural = d20.length === 1 ? d20[0].kept[0] : null
  return {
    label,
    expression: result.expression,
    result,
    verdict: natural === 20 ? '20 natural' : natural !== null && natural >= critFrom ? 'Crítico' : natural === 1 ? '1 natural' : null,
    tone: natural !== null && natural >= Math.min(20, critFrom) ? 'critico' : natural === 1 ? 'desastre' : 'neutro',
  }
}

/** A rolagem de uma perícia, já com os valores da ficha (ex.: "1d20+3+2"). */
export function skillExpression(system: GameSystem, sheet: Sheet, skillId: string): string {
  const skill = system.skills.find((s) => s.id === skillId)
  return expandFormula(system.skillFormula, { system, sheet, attributeId: skill?.attributeId, skillValue: sheet.skills[skillId] ?? 0 })
}

/** A rolagem de um atributo, já com os valores da ficha. */
export function attributeExpression(system: GameSystem, sheet: Sheet, attributeId: string): string {
  return expandFormula(system.attributeFormula, { system, sheet, attributeId })
}

/**
 * O que mostrar ao lado de uma perícia: com um dado só, o bônus a somar ("+5", o que importa
 * para quem rola o dado de verdade); com mais dados, a rolagem toda ("3d20kh1+5").
 */
export function bonusLabel(expression: string): string {
  const terms = expression.replace(/\s+/g, '').match(/[+-]?[^+-]+/g) ?? []
  const dice = terms.filter((t) => /d/i.test(t))
  if (dice.length !== 1 || !/^\+?1?d\d+$/i.test(dice[0])) return expression
  const bonus = terms.filter((t) => !/d/i.test(t)).reduce((n, t) => n + Number(t), 0)
  return bonus >= 0 ? `+${bonus}` : String(bonus)
}

export function rollSkill(system: GameSystem, sheet: Sheet, skillId: string, random?: () => number): RollOutcome {
  const skill = system.skills.find((s) => s.id === skillId)
  const value = sheet.skills[skillId] ?? 0
  const expr = skillExpression(system, sheet, skillId)
  return resolveRoll(system, skill?.name ?? 'Perícia', expr, system.resolution === 'abaixo' ? value : undefined, random)
}

export function rollAttribute(system: GameSystem, sheet: Sheet, attributeId: string, random?: () => number): RollOutcome {
  const attr = system.attributes.find((a) => a.id === attributeId)
  const value = attrValue({ system, sheet }, attributeId)
  const expr = expandFormula(system.attributeFormula, { system, sheet, attributeId })
  return resolveRoll(system, attr?.name ?? 'Atributo', expr, system.resolution === 'abaixo' ? value : undefined, random)
}

export function rollInitiative(system: GameSystem, sheet: Sheet | null, random?: () => number): number {
  return roll(expandFormula(system.initiativeFormula, { system, sheet }), random).total
}

/** Refaz a conta de uma rolagem com o que saiu nos dados físicos. */
export function physicalRoll(system: GameSystem, o: RollOutcome, faces: number[]): RollOutcome {
  const out = resolveRoll(system, o.name ?? o.label, o.expression, o.target, physicalRandom(o.expression, faces), o.critFrom)
  return { ...out, physical: true }
}

/** Texto curto de uma rolagem, para o registro da sessão. */
export function describeOutcome(o: RollOutcome, who?: string): string {
  const dice = o.result.parts
    .filter((p) => p.rolls.length)
    .map((p) => `[${p.rolls.join(', ')}]`)
    .join(' ')
  return `${who ? `${who} — ` : ''}${o.label}: ${o.result.total}${o.verdict ? ` (${o.verdict})` : ''} · ${o.expression} ${dice}${o.physical ? ' · dado físico' : ''}`.trim()
}
