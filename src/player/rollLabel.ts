import type { TableRoll } from '../share/server'

/** O nome de uma rolagem como a mesa lê: "Espada longa contra Goblin", "Espada longa (dano) em Goblin". */
export const rollLabel = (r: TableRoll) => (r.aim ? `${r.name} ${r.kind === 'dano' ? 'em' : 'contra'} ${r.aim.name}` : r.name)
