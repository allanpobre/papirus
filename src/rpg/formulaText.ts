import { fold } from '../logic/text'
import type { GameSystem } from '../model/schema'

/**
 * A fórmula de um sistema em palavras, para quem só quer ler: "1d20+{mod:DES}" vira "1d20 + modificador de Destreza".
 * (O editor de sistemas continua mostrando a fórmula crua, que é onde ela se escreve.)
 */
export function formulaText(system: Pick<GameSystem, 'attributes' | 'resources'>, formula: string): string {
  const attr = (abbr: string) => system.attributes.find((a) => fold(a.abbr) === fold(abbr))
  const out = formula.replace(/\{\s*(mod:|per:)?([^}]+?)\s*\}/g, (_m, prefix: string | undefined, key: string) => {
    const k = fold(key)
    if (prefix === 'per:') return `perícia ${key}`
    if (!prefix && k === 'atr') return 'o atributo'
    if (!prefix && k === 'mod') return 'o modificador do atributo'
    if (!prefix && k === 'per') return 'a perícia'
    const a = attr(key)
    if (a) return prefix === 'mod:' ? `modificador de ${a.name}` : a.name
    const r = system.resources.find((x) => fold(x.abbr) === k)
    return r ? r.name : key
  })
  // Um atributo antes de "d20" é a quantidade de dados: "Agilidade d20" lê melhor que "Agilidaded20".
  const spaced = out.replace(/([\p{L}])(d\d)/gu, (m, l: string, d: string) => (/^d$/i.test(l) ? m : `${l} ${d}`))
  // Espaço em volta dos sinais, para ler: "1d20+Destreza" → "1d20 + Destreza".
  return spaced.replace(/\s*([+\-])\s*/g, ' $1 ').replace(/\s+/g, ' ').trim()
}
