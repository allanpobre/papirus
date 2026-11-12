import { generateNames, type NameStyle } from './names'
import type { Universe } from '../model/schema'
import { draftEntity, draftRelation, insert } from '../model/universe'

/**
 * Semente do mundo: cinco perguntas para sair da página em branco. As respostas viram os
 * primeiros rascunhos de fichas (quem manda, a capital, quem governa, quem se opõe, o que move
 * o mundo e o que o ameaça), já ligados entre si e com uma frase de resumo cada.
 */
export const SEED_QUESTIONS = [
  {
    id: 'genero',
    label: 'Que mundo é este?',
    options: [
      ['fantasia', 'Fantasia'],
      ['ficcao', 'Ficção científica'],
      ['pos', 'Pós-apocalipse'],
      ['historico', 'Histórico'],
      ['urbano', 'Fantasia urbana'],
    ],
  },
  {
    id: 'tom',
    label: 'Qual o tom?',
    options: [
      ['esperanca', 'Esperançoso'],
      ['sombrio', 'Sombrio'],
      ['aventura', 'Aventureiro'],
      ['misterio', 'Misterioso'],
    ],
  },
  {
    id: 'poder',
    label: 'O que move o mundo?',
    options: [
      ['magia-rara', 'Magia rara e temida'],
      ['magia-comum', 'Magia do dia a dia'],
      ['tecnologia', 'Tecnologia avançada'],
      ['nada', 'Nem magia nem máquinas'],
    ],
  },
  {
    id: 'governo',
    label: 'Quem manda?',
    options: [
      ['reino', 'Um reino'],
      ['imperio', 'Um império'],
      ['cidades', 'Cidades rivais'],
      ['ninguem', 'Ninguém: terra sem lei'],
    ],
  },
  {
    id: 'ameaca',
    label: 'O que ameaça tudo?',
    options: [
      ['guerra', 'Uma guerra'],
      ['praga', 'Uma praga'],
      ['antigo', 'Algo antigo que acordou'],
      ['fome', 'Fome e escassez'],
    ],
  },
] as const

export type SeedQuestion = (typeof SEED_QUESTIONS)[number]
export type SeedAnswers = { [Q in SeedQuestion as Q['id']]: Q['options'][number][0] } & {
  /** O nome da ameaça, se a pessoa quiser escrever (senão, o Papirus sugere). */
  ameacaNome?: string
}

export const DEFAULT_SEED: SeedAnswers = { genero: 'fantasia', tom: 'aventura', poder: 'magia-rara', governo: 'reino', ameaca: 'antigo' }

const label = (id: SeedQuestion['id'], v: string) => (SEED_QUESTIONS.find((q) => q.id === id)!.options as readonly (readonly [string, string])[]).find(([k]) => k === v)?.[1] ?? v

const PEOPLE: Record<SeedAnswers['genero'], NameStyle> = { fantasia: 'fantasia', ficcao: 'ficcao', pos: 'ficcao', historico: 'pessoas', urbano: 'pessoas' }
const PLACES: Record<SeedAnswers['genero'], NameStyle> = { fantasia: 'lugaresFantasia', ficcao: 'lugaresFantasia', pos: 'lugares', historico: 'lugares', urbano: 'lugares' }

const TONE: Record<SeedAnswers['tom'], { adj: string; ruler: string; rebels: string }> = {
  esperanca: { adj: 'esperançoso', ruler: 'Ainda acredita que dá para consertar as coisas.', rebels: 'Querem um mundo mais justo, e estão dispostos a esperar.' },
  sombrio: { adj: 'sombrio', ruler: 'Esconde mais do que mostra, e confia em pouca gente.', rebels: 'Não têm mais nada a perder.' },
  aventura: { adj: 'cheio de aventura', ruler: 'Nunca recusa um desafio, nem quando devia.', rebels: 'Agem rápido e fazem barulho.' },
  misterio: { adj: 'cheio de mistérios', ruler: 'Ninguém sabe ao certo de onde veio.', rebels: 'Ninguém sabe quem são, nem quantos.' },
}

const THREAT: Record<SeedAnswers['ameaca'], { name: (place: string) => string; summary: string }> = {
  guerra: { name: (p) => `A Guerra de ${p}`, summary: 'Começou na fronteira e já chega às cidades.' },
  praga: { name: () => 'A Praga Cinzenta', summary: 'Ninguém sabe de onde veio; quem adoece não volta a ser o mesmo.' },
  antigo: { name: () => 'O Que Dorme', summary: 'Algo antigo, esquecido há séculos, acordou.' },
  fome: { name: () => 'Os Anos Magros', summary: 'As colheitas falham há três anos seguidos.' },
}

/** Planta a semente: devolve o universo com as fichas, as ligações e uma descrição do mundo. */
export function sowWorld(universe: Universe, a: SeedAnswers, random = Math.random): { universe: Universe; created: number } {
  const taken = new Set(universe.entities.map((e) => e.name.toLocaleLowerCase('pt-BR')))
  const pick = (style: NameStyle) => {
    const own = universe.entities.map((e) => e.name)
    const name = generateNames(own, style, 12, random).find((n) => !taken.has(n.toLocaleLowerCase('pt-BR'))) ?? generateNames([], style, 1, random)[0]
    taken.add(name.toLocaleLowerCase('pt-BR'))
    return name
  }
  let u = universe
  const before = u.entities.length
  const add = (kind: string, name: string, summary: string, parentId: string | null = null) => {
    const [next, e] = insert(u, 'entities', { ...draftEntity(kind, name), summary, parentId })
    u = next
    return e
  }
  const link = (from: string, to: string, type: string) => {
    u = insert(u, 'relations', draftRelation(from, to, type))[0]
  }
  const tone = TONE[a.tom]
  const placeName = pick(PLACES[a.genero])

  // Quem manda (e onde).
  let realm: { id: string; name: string }
  let capital: { id: string; name: string }
  if (a.governo === 'cidades') {
    realm = add('lugar', placeName, 'Uma das cidades que disputam a região.')
    const rival = add('lugar', pick(PLACES[a.genero]), `Rival de ${placeName} há gerações.`)
    link(realm.id, rival.id, 'rival de')
    capital = realm
  } else if (a.governo === 'ninguem') {
    realm = add('reino', `Terras de ${placeName}`, 'Uma região sem lei, onde vale quem é mais forte.')
    capital = add('lugar', pick(PLACES[a.genero]), 'O lugar onde todos acabam passando: mercado, abrigo e encrenca.', realm.id)
  } else {
    const kind = a.governo === 'imperio' ? 'Império' : 'Reino'
    realm = add('reino', `${kind} de ${placeName}`, a.governo === 'imperio' ? 'Um império que cresceu engolindo os vizinhos.' : 'Um reino antigo, orgulhoso das suas tradições.')
    capital = add('lugar', pick(PLACES[a.genero]), `A capital do ${kind.toLocaleLowerCase('pt-BR')}.`, realm.id)
  }

  // Quem governa e quem se opõe.
  const ruler = add('personagem', pick(PEOPLE[a.genero]), `${a.governo === 'ninguem' ? 'Chefe do bando mais temido da região' : `Governa ${realm.name}`}. ${tone.ruler}`)
  link(ruler.id, realm.id, a.governo === 'ninguem' ? 'domina' : 'governa')
  const rebels = add('faccao', `Os Filhos de ${capital.name}`, `Querem tirar ${ruler.name} do poder. ${tone.rebels}`)
  link(rebels.id, ruler.id, 'inimigo de')

  // O que move o mundo.
  if (a.poder === 'magia-rara' || a.poder === 'magia-comum') {
    const art = add('magia', a.poder === 'magia-rara' ? 'O Dom' : 'A Arte', a.poder === 'magia-rara' ? 'Poucos nascem com ele, e quase todos o escondem.' : 'Está em toda parte: na cozinha, no mercado, nos remédios.')
    link(rebels.id, art.id, a.poder === 'magia-rara' ? 'protege quem tem' : 'usa')
  } else if (a.poder === 'tecnologia') {
    const tech = add('conceito', 'A Rede', 'A tecnologia que liga tudo e todos, e que poucos entendem de verdade.')
    link(ruler.id, tech.id, 'controla')
  }

  // O que ameaça tudo.
  const threat = THREAT[a.ameaca]
  const danger = add('conceito', a.ameacaNome?.trim() || threat.name(placeName), threat.summary)
  link(danger.id, realm.id, 'ameaça')

  const world = `Um mundo de ${label('genero', a.genero).toLocaleLowerCase('pt-BR')} ${tone.adj}: ${label('poder', a.poder).toLocaleLowerCase('pt-BR')}, ${label('governo', a.governo).toLocaleLowerCase('pt-BR')} e ${label('ameaca', a.ameaca).toLocaleLowerCase('pt-BR')}.`
  u = { ...u, description: u.description.trim() || world }
  return { universe: u, created: u.entities.length - before }
}
