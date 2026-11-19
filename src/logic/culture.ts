import type { Entity, Universe } from '../model/schema'
import { answerOf } from './kindQuestions'
import { hasLanguage, translate } from './language'

/*
 * Culturas vivas: cartas de pergunta sobre o dia a dia (comida, cumprimento, tabu…). A resposta vira um campo
 * da ficha (como as perguntas por tipo). "Um dia na vida" monta um texto curto com as respostas, por regras.
 */

export interface CultureCard {
  key: string
  ask: string
  /** Sugestões para tocar (a pessoa pode escrever a sua). */
  ideas: string[]
}

export const CULTURE_CARDS: CultureCard[] = [
  { key: 'Comida', ask: 'O que comem no dia a dia?', ideas: ['pão de cinza e peixe seco', 'carne assada na pedra', 'frutas e mel, nunca carne'] },
  { key: 'Roupa', ask: 'Como se vestem?', ideas: ['mantos de lã tingidos de azul', 'couro e ossos pintados', 'tecidos leves que mostram as tatuagens'] },
  { key: 'Cumprimento', ask: 'Como se cumprimentam?', ideas: ['tocando a testa um do outro', 'mostrando as mãos vazias', 'dizendo o nome da mãe'] },
  { key: 'Tabu', ask: 'O que nunca se faz?', ideas: ['dizer o nome de um morto', 'comer sozinho', 'cortar o cabelo antes do casamento'] },
  { key: 'Morte', ask: 'O que fazem com os mortos?', ideas: ['entregam ao mar num barco de palha', 'queimam e guardam as cinzas em casa', 'enterram sob a árvore da família'] },
  { key: 'Belo', ask: 'O que acham bonito?', ideas: ['cicatrizes de batalha', 'mãos calejadas', 'silêncio'] },
  { key: 'Trabalho', ask: 'Do que vivem?', ideas: ['pesca e sal', 'pastoreio nas montanhas', 'comércio pelas rotas do deserto'] },
  { key: 'Crianças', ask: 'Como uma criança vira adulto?', ideas: ['passa uma noite sozinha na floresta', 'escolhe o próprio nome aos doze', 'aprende o ofício da família'] },
]

const low = (t: string) => t.trim().replace(/[.!]+$/, '')
const first = (t: string) => t.charAt(0).toLocaleUpperCase('pt-BR') + t.slice(1)

/** Um dia na vida de alguém desta cultura, montado com as respostas (as perguntas sem resposta ficam de fora). */
export function dayInLife(e: Entity, u: Universe): string {
  const a = (k: string) => low(answerOf(e.fields, k))
  const who = `alguém de ${e.name}`
  const lines: string[] = []
  const work = a('Trabalho')
  lines.push(work ? `Antes do sol, ${who} já está de pé: aqui se vive de ${work}.` : `Antes do sol, ${who} já está de pé.`)
  if (a('Roupa')) lines.push(`Veste ${a('Roupa')}.`)
  if (a('Cumprimento')) {
    const lang = e.language && hasLanguage(e) ? e.language : null
    const word = lang ? translate(lang, 'olá')[0]?.word : ''
    lines.push(`Na rua, cumprimenta os vizinhos ${a('Cumprimento')}${word ? ` e diz “${first(word)}”` : ''}.`)
  }
  if (a('Comida')) lines.push(`No almoço, ${a('Comida')}.`)
  if (a('Tabu')) lines.push(`Ninguém ousa ${a('Tabu').replace(/^nunca\s+/i, '')}: seria uma vergonha.`)
  if (a('Belo')) lines.push(`Quando quer elogiar alguém, fala de ${a('Belo')}.`)
  if (a('Crianças')) lines.push(`As crianças olham os mais velhos e esperam o dia em que cada uma ${a('Crianças')}.`)
  if (a('Morte')) lines.push(`À noite, lembra dos seus mortos: aqui, ${a('Morte')}.`)
  const feast = nextFeast(e, u)
  if (feast) lines.push(`E todos já esperam a próxima festa: ${feast}.`)
  return lines.length > 1 ? lines.join(' ') : ''
}

/** "Festa da Primeira Chuva (3 de Brumal)": a primeira festa do ano, com a data se houver calendário. */
function nextFeast(e: Entity, u: Universe): string {
  const f = feastsOf(u).find((x) => x.culture.id === e.id)
  return f ? f.name + (f.when ? ` (${f.when})` : '') : ''
}

export interface FeastRow {
  id: string
  name: string
  about: string
  /** "3 de Brumal", "Brumal" ou vazio. */
  when: string
  /** Para ordenar no ano (sem data, vai para o fim). */
  order: number
  culture: Entity
}

/** As festas de todas as culturas, na ordem do ano. Segredos ficam de fora. */
export function feastsOf(u: Universe): FeastRow[] {
  const months = u.settings.calendarMonths
  const rows: FeastRow[] = []
  for (const c of u.entities) {
    if (c.canon === 'secreto') continue
    for (const f of c.feasts ?? []) {
      if (!f.name.trim()) continue
      const month = f.month !== undefined ? months[f.month] : undefined
      const when = month ? (f.day ? `${f.day} de ${month.name}` : month.name) : ''
      rows.push({ id: f.id, name: f.name.trim(), about: f.about, when, order: f.month !== undefined ? f.month * 1000 + (f.day ?? 0) : 1e9, culture: c })
    }
  }
  return rows.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'pt-BR'))
}
