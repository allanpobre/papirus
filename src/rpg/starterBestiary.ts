import type { Universe } from '../model/schema'
import { insert, newId, type Draft } from '../model/universe'

type Starter = Omit<Draft<'monsters'>, 'attacks'> & { attacks: { name: string; bonus: number; damage: string; critical: string }[] }

/**
 * Inimigos comuns para quem nunca mestrou: vida, Defesa e ataque de cinco criaturas conhecidas, no estilo
 * dos d20 (valores do documento de referência livre do D&D 5e). Servem de ponto de partida: cada número
 * pode ser acertado para o sistema da mesa.
 */
export const STARTER_MONSTERS: Starter[] = [
  { name: 'Goblin', hp: 7, defense: 15, initiative: 2, attacks: [{ name: 'Cimitarra', bonus: 4, damage: '1d6+2', critical: '' }], notes: 'Pequeno, esperto e covarde: foge quando o grupo vence.' },
  { name: 'Lobo', hp: 11, defense: 13, initiative: 2, attacks: [{ name: 'Mordida', bonus: 4, damage: '2d4+2', critical: '' }], notes: 'Ataca em bando e cerca quem está sozinho.' },
  { name: 'Esqueleto', hp: 13, defense: 13, initiative: 2, attacks: [{ name: 'Espada curta', bonus: 4, damage: '1d6+2', critical: '' }], notes: 'Não sente medo nem cansaço.' },
  { name: 'Bandido', hp: 11, defense: 12, initiative: 1, attacks: [{ name: 'Cimitarra', bonus: 3, damage: '1d6+1', critical: '' }], notes: 'Quer o dinheiro, não a luta. Pode se render.' },
  { name: 'Ogro', hp: 59, defense: 11, initiative: -1, attacks: [{ name: 'Clava grande', bonus: 6, damage: '2d8+4', critical: '' }], notes: 'Forte e lento. Um bom "chefe" para um grupo iniciante.' },
]

/** Quais inimigos comuns ainda não estão no bestiário (pelo nome). */
export const missingStarters = (u: Universe): Starter[] => STARTER_MONSTERS.filter((s) => !u.monsters.some((m) => m.name.trim().toLowerCase() === s.name.toLowerCase()))

/** Põe no bestiário os inimigos comuns que faltam. Devolve o universo e o id do primeiro (o Goblin) para já escolher. */
export function addStarterMonsters(u: Universe): [Universe, string | null] {
  let next = u
  let first: string | null = null
  for (const s of missingStarters(u)) {
    const [after, m] = insert(next, 'monsters', { ...s, attacks: s.attacks.map((a) => ({ ...a, id: newId() })) })
    next = after
    first ??= m.id
  }
  return [next, first]
}
