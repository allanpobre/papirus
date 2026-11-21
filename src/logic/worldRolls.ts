import type { Entity, Universe } from '../model/schema'
import { languageNames, languagesOf } from './language'
import { generateNames } from './names'

/*
 * Rolar no mundo: tabelas que sorteiam a partir do que já existe (lugares, povos, personagens, grupos e as
 * línguas do mundo). O texto vem com marcas como {lugar} e {personagem}, que viram nomes de verdade; sem
 * fichas daquele tipo, entra uma palavra comum. As tabelas da Mesa (do universo) também rolam aqui e aceitam
 * as mesmas marcas.
 */

export interface WorldTable {
  id: string
  name: string
  entries: string[]
}

export const WORLD_TABLES: WorldTable[] = [
  {
    id: 'boato',
    name: 'Boato',
    entries: [
      'Dizem que {personagem} foi visto em {lugar} com alguém de {povo}, falando baixo.',
      'Em {lugar}, contam que {grupo} anda comprando {objeto} de madrugada.',
      'Um bêbado jura que {personagem} não é quem diz ser: veio de {lugar}.',
      'Corre que {nomeNovo}, de {povo}, achou {objeto} e sumiu no dia seguinte.',
      'Os velhos de {lugar} dizem que {grupo} tem um segredo desde a última {estacao}.',
    ],
  },
  {
    id: 'encontro',
    name: 'Encontro na estrada',
    entries: [
      'Três viajantes de {povo} pedem passagem até {lugar}.',
      'Uma carroça tombada de {grupo}, com {objeto} espalhado pela estrada.',
      '{nomeNovo}, que diz conhecer {personagem}, oferece ajuda em troca de um favor.',
      'Um mensageiro com o selo de {grupo}, ferido, sem dizer de onde vem.',
      'Uma placa nova, apontando para {lugar}, que não estava ali ontem.',
    ],
  },
  {
    id: 'taverna',
    name: 'Nome de taverna',
    entries: ['O {objeto} Quebrado', 'A Última {estacao}', 'O Descanso de {nomeNovo}', 'A Porta de {lugar}', 'O Gole de {povo}'],
  },
  {
    id: 'segredo',
    name: 'Segredo',
    entries: [
      '{personagem} deve dinheiro a {grupo}.',
      '{personagem} nasceu em {lugar}, não onde conta.',
      '{personagem} guarda {objeto} que pertence a {grupo}.',
      '{personagem} já foi amigo de quem hoje chama de inimigo.',
      '{personagem} sabe o nome verdadeiro de {nomeNovo}.',
    ],
  },
  {
    id: 'clima',
    name: 'Clima do dia',
    entries: ['Névoa grossa até o meio-dia em {lugar}.', 'Chuva fina que não para.', 'Calor parado, sem vento nenhum.', 'Vento forte vindo de {lugar}.', 'Céu limpo e frio, perfeito para viajar.'],
  },
  {
    id: 'festa',
    name: 'Festa local',
    entries: [
      'Em {lugar}, a festa de {estacao}: todos usam algo de {objeto}.',
      '{grupo} oferece um banquete para lembrar {nomeNovo}.',
      'O povo de {povo} acende fogueiras na noite mais longa.',
      'Uma corrida pelas ruas de {lugar}; quem perde paga a bebida.',
    ],
  },
]

const COMMON: Record<string, string[]> = {
  lugar: ['o porto', 'a vila do vale', 'a cidade velha', 'a fronteira', 'o mosteiro'],
  personagem: ['um estranho', 'a filha do ferreiro', 'o velho guarda', 'uma viajante'],
  povo: ['longe', 'as montanhas', 'o outro lado do mar'],
  grupo: ['a guilda', 'a guarda', 'os mercadores', 'o conselho'],
  objeto: ['sal', 'ferro', 'um mapa', 'uma chave antiga', 'âmbar', 'pergaminho', 'lanterna'],
  estacao: ['colheita', 'neve', 'lua cheia', 'maré alta'],
}
const KINDS: Record<string, string[]> = {
  lugar: ['lugar', 'reino'],
  personagem: ['personagem'],
  povo: ['especie', 'cultura'],
  grupo: ['faccao', 'religiao', 'reino'],
}

const pick = <T,>(list: T[], random: () => number): T => list[Math.floor(random() * list.length)]

export interface Rolled {
  text: string
  /** As fichas do mundo que entraram no sorteio (para ligar a pista ou a ideia). */
  entityIds: string[]
}

/** Um nome novo, na língua de um povo do mundo (quando há) ou no estilo dos nomes que já existem. */
function newName(u: Universe, random: () => number): string {
  const langs = languagesOf(u)
  if (langs.length) {
    const l = pick(langs, random)
    const names = languageNames(l.language!, 1, random)
    if (names[0]) return names[0]
  }
  const samples = u.entities.filter((e) => e.kind === 'personagem').map((e) => e.name.split(/\s+/)[0]).filter(Boolean)
  return generateNames(samples, 'fantasia', 1, random)[0] ?? 'Arel'
}

/** Troca as marcas {lugar}, {personagem}… por nomes do mundo. Segredos ficam de fora. */
export function fillEntry(entry: string, u: Universe, random = Math.random): Rolled {
  const ids: string[] = []
  const pool = (kinds: string[]): Entity[] => u.entities.filter((e) => kinds.includes(e.kind) && e.canon !== 'secreto' && e.name.trim())
  const text = entry.replace(/\{(\w+)\}/g, (all, key: string) => {
    if (key === 'nomeNovo') return newName(u, random)
    const kinds = KINDS[key]
    const real = kinds ? pool(kinds) : []
    if (real.length) {
      const e = pick(real, random)
      ids.push(e.id)
      return e.name
    }
    return COMMON[key] ? pick(COMMON[key], random) : all
  })
  return { text: contract(text), entityIds: [...new Set(ids)] }
}

/** "de as montanhas" vira "das montanhas": junta a preposição ao artigo que veio da frase pronta (o nome da ficha não leva artigo). */
export function contract(text: string): string {
  const base: Record<string, string> = { de: 'd', em: 'n', a: '' }
  return text.replace(/\b(de|em|a) (o|a|os|as)\b(?= )/g, (_m, p: string, art: string) => (p === 'a' ? `a${art}`.replace(/^aa$/, 'à').replace(/^aas$/, 'às') : `${base[p]}${art}`))
}

/** Rola uma tabela (pronta ou do universo). */
export function rollTable(table: Pick<WorldTable, 'entries'>, u: Universe, random = Math.random): Rolled | null {
  const entries = table.entries.filter((e) => e.trim())
  if (!entries.length) return null
  return fillEntry(pick(entries, random), u, random)
}
