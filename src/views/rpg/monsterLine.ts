import type { Monster } from '../../model/schema'

const signed = (n: number) => (n >= 0 ? `+${n}` : String(n))

/** "PV 7 · CA 12 · Cimitarra +4 (1d6+2)". */
export function monsterLine(m: Monster, defLabel: string): string {
  return [`PV ${m.hp}`, m.defense !== null ? `${defLabel} ${m.defense}` : '', ...m.attacks.map((a) => `${a.name} ${signed(a.bonus)}${a.damage ? ` (${a.damage})` : ''}`)].filter(Boolean).join(' · ')
}
