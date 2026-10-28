export interface DiceTerm {
  sign: 1 | -1
  count: number
  sides: number
  /** Manter os N maiores (kh) ou menores (kl). */
  keep?: { mode: 'h' | 'l'; n: number }
}

export interface DiceRoll {
  expression: string
  total: number
  /** Detalhe de cada termo: rolagens e quais foram mantidas. */
  parts: { label: string; rolls: number[]; kept: number[]; value: number }[]
}

export class DiceError extends Error {}

const MAX_DICE = 200
const MAX_SIDES = 1000

/** Rola uma expressão como "d20", "2d6+3", "4d6kh3", "1d8+1d6-1". */
export function roll(expression: string, random: () => number = secureRandom): DiceRoll {
  const expr = expression.replace(/\s+/g, '').toLowerCase()
  if (!expr) throw new DiceError('Digite uma rolagem, como 1d20+5.')
  const tokens = expr.match(/[+-]?[^+-]+/g)
  if (!tokens || tokens.join('') !== expr) throw new DiceError(`Não entendi “${expression}”.`)

  let total = 0
  const parts: DiceRoll['parts'] = []
  let diceUsed = 0

  for (const raw of tokens) {
    const sign = raw.startsWith('-') ? -1 : 1
    const body = raw.replace(/^[+-]/, '')
    const dice = body.match(/^(\d*)d(\d+|%)(?:k([hl])(\d+))?$/)
    if (dice) {
      const count = dice[1] ? Number(dice[1]) : 1
      const sides = dice[2] === '%' ? 100 : Number(dice[2])
      if (count < 1 || sides < 2) throw new DiceError(`Dado inválido: “${body}”.`)
      diceUsed += count
      if (diceUsed > MAX_DICE || sides > MAX_SIDES) throw new DiceError('Dados demais nessa rolagem.')
      const rolls = Array.from({ length: count }, () => 1 + Math.floor(random() * sides))
      let kept = rolls
      if (dice[3]) {
        const n = Math.min(Number(dice[4]), count)
        const sorted = [...rolls].sort((a, b) => (dice[3] === 'h' ? b - a : a - b))
        kept = sorted.slice(0, n)
      }
      const value = sign * kept.reduce((a, b) => a + b, 0)
      total += value
      parts.push({ label: (sign < 0 ? '-' : parts.length ? '+' : '') + body, rolls, kept, value })
    } else if (/^\d+$/.test(body)) {
      const value = sign * Number(body)
      total += value
      parts.push({ label: (sign < 0 ? '-' : '+') + body, rolls: [], kept: [], value })
    } else {
      throw new DiceError(`Não entendi “${body}”. Use algo como 2d6+3.`)
    }
  }
  return { expression: expr, total, parts }
}

function secureRandom(): number {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return buf[0] / 2 ** 32
}

/** Os dados de uma expressão, na ordem em que são rolados (o número de lados de cada um). */
export function diceIn(expression: string): number[] {
  const expr = expression.replace(/\s+/g, '').toLowerCase()
  const out: number[] = []
  for (const raw of expr.match(/[+-]?[^+-]+/g) ?? []) {
    const dice = raw.replace(/^[+-]/, '').match(/^(\d*)d(\d+|%)(?:k[hl]\d+)?$/)
    if (!dice) continue
    const count = dice[1] ? Number(dice[1]) : 1
    const sides = dice[2] === '%' ? 100 : Number(dice[2])
    for (let i = 0; i < count && out.length < MAX_DICE; i++) out.push(sides)
  }
  return out
}

/**
 * Dado físico: a pessoa rolou na mesa e diz o que saiu; a rolagem usa esses números
 * no lugar do sorteio (o resto da conta, modificadores e leitura, é a mesma).
 */
export function physicalRandom(expression: string, faces: number[]): () => number {
  const sides = diceIn(expression)
  if (faces.length !== sides.length) throw new DiceError(`Essa rolagem tem ${sides.length} ${sides.length === 1 ? 'dado' : 'dados'}.`)
  faces.forEach((f, i) => {
    if (!Number.isInteger(f) || f < 1 || f > sides[i]) throw new DiceError(`No d${sides[i]}, o número vai de 1 a ${sides[i]}.`)
  })
  let i = 0
  return () => {
    const n = sides[i]
    const f = faces[i++]
    return (f - 0.5) / n
  }
}
