import { fold } from '../logic/text'
import type { GameSystem } from '../model/schema'

/**
 * A fórmula de um sistema em palavras, para quem só quer ler: "1d20+{mod:DES}" vira "1d20 + modificador de Destreza".
 * (O editor de sistemas continua mostrando a fórmula crua, que é onde ela se escreve.)
 */
export function formulaText(system: Pick<GameSystem, 'attributes' | 'resources'>, formula: string): string {
  const attr = (abbr: string) => system.attributes.find((a) => fold(a.abbr) === fold(abbr))
  const word = (token: string): string => {
    const m = token.match(/^\{\s*(mod:|per:)?([^}]+?)\s*\}$/)!
    const [, prefix, key] = m
    const k = fold(key)
    if (prefix === 'per:') return `perícia ${key}`
    if (!prefix && k === 'atr') return 'o atributo'
    if (!prefix && k === 'mod') return 'o modificador do atributo'
    if (!prefix && k === 'per') return 'a perícia'
    const a = attr(key)
    if (a) return prefix === 'mod:' ? `modificador de ${a.name}` : a.name
    const r = system.resources.find((x) => fold(x.abbr) === k)
    return r ? r.name : key
  }
  // Pedaços: as chaves viram palavras (sem mexer nos hífens e letras dos nomes); o resto é fórmula e ganha espaço nos sinais.
  const parts = formula.split(/(\{[^}]*\})/)
  const out = parts.map((p, i) => {
    if (p.startsWith('{')) {
      // Um atributo logo antes de "d20" é a quantidade de dados: "Agilidade d20".
      return word(p) + (/^d\d/.test(parts[i + 1] ?? '') ? ' ' : '')
    }
    return p.replace(/\s*([+-])\s*/g, ' $1 ')
  })
  return out.join('').replace(/\s+/g, ' ').replace(/^ - /, '-').trim()
}
