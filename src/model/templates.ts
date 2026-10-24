import { systemFromTemplate } from '../rpg/systems'
import type { Universe } from './schema'
import { addScene, addStory, draftGroup, draftSeed, draftSession, insert } from './universe'

/**
 * Modelos de universo: um ponto de partida para quem trava na tela em branco.
 * Nada é escrito pelo autor: só estrutura (uma história, a primeira cena), calendário
 * e campos sugeridos por tipo de ficha. Tudo pode ser mudado ou apagado depois.
 */
export interface UniverseTemplate {
  id: 'branco' | 'fantasia' | 'ficcao' | 'misterio' | 'realista' | 'rpg'
  label: string
  /** Duas ou três palavras para o cartão. */
  short: string
  hint: string
  apply: (u: Universe) => Universe
}

const months = (names: string[], days = 30) => names.map((name) => ({ name, days }))

function startStory(u: Universe, title: string, firstScene = 'Capítulo 1'): Universe {
  let story
  ;[u, story] = addStory(u, title)
  ;[u] = addScene(u, story.id, firstScene)
  return u
}

const FANTASY_FIELDS = {
  personagem: ['Idade', 'Aparência', 'Objetivo', 'Medo', 'Segredo'],
  lugar: ['Clima', 'Quem governa', 'População', 'Perigos'],
  faccao: ['Líder', 'Objetivo', 'Recursos', 'Inimigos'],
  magia: ['Fonte', 'Custo', 'Limites', 'Quem pode usar'],
  reino: ['Governante', 'Capital', 'Moeda', 'Aliados'],
  artefato: ['Origem', 'Poder', 'Preço de usar'],
  religiao: ['Divindades', 'Rituais', 'Tabus'],
  especie: ['Aparência', 'Onde vive', 'Costumes'],
}

export const UNIVERSE_TEMPLATES: UniverseTemplate[] = [
  { id: 'branco', label: 'Em branco', short: 'Só o nome', hint: 'Só o nome. Você monta o resto.', apply: (u) => u },
  {
    id: 'fantasia',
    label: 'Fantasia',
    short: 'Magia, reinos, calendário',
    hint: 'Calendário de 12 meses, campos para magia, reinos e facções, “Livro I”.',
    apply: (u) =>
      startStory(
        {
          ...u,
          settings: {
            ...u.settings,
            calendarSuffix: 'DC',
            calendarMonths: months(['Geada', 'Degelo', 'Semeadura', 'Flor', 'Sol Alto', 'Colheita', 'Brasa', 'Vindima', 'Névoa', 'Cinza', 'Longa Noite', 'Solstício']),
            fieldTemplates: FANTASY_FIELDS,
          },
        },
        'Livro I',
      ),
  },
  {
    id: 'ficcao',
    label: 'Ficção científica',
    short: 'Naves, planetas, facções',
    hint: 'Anos da Era Comum, campos para naves, planetas, tecnologia e facções.',
    apply: (u) =>
      startStory(
        {
          ...u,
          settings: {
            ...u.settings,
            calendarSuffix: 'EC',
            fieldTemplates: {
              personagem: ['Idade', 'Função', 'Origem', 'Implantes ou tecnologia', 'Objetivo'],
              lugar: ['Tipo (planeta, estação, nave)', 'Atmosfera', 'População', 'Quem controla'],
              faccao: ['Líder', 'Ideologia', 'Tecnologia', 'Território'],
              conceito: ['Como funciona', 'Limites', 'Quem controla'],
              artefato: ['Fabricante', 'Função', 'Defeito conhecido'],
              especie: ['Biologia', 'Planeta natal', 'Comunicação'],
            },
          },
        },
        'Parte I',
      ),
  },
  {
    id: 'misterio',
    label: 'Mistério',
    short: 'Suspeitos, pistas, álibis',
    hint: 'Suspeitos com álibi e motivo, pistas e um caso para resolver.',
    apply: (u) => {
      u = startStory(
        {
          ...u,
          settings: {
            ...u.settings,
            fieldTemplates: {
              personagem: ['Idade', 'Ocupação', 'Álibi', 'Motivo', 'O que esconde'],
              lugar: ['Endereço', 'Quem frequenta', 'Detalhe importante'],
              artefato: ['Onde foi achado', 'De quem é', 'O que prova'],
            },
          },
        },
        'O caso',
      )
      ;[u] = insert(u, 'seeds', { ...draftSeed('Quem fez?', 'misterio'), description: 'Anote as pistas conforme aparecem. A resposta fica só com você.' })
      return u
    },
  },
  {
    id: 'realista',
    label: 'Romance realista',
    short: 'Família, desejo, cidade',
    hint: 'Personagens com família, desejo e ferida; lugares com bairro e atmosfera.',
    apply: (u) =>
      startStory(
        {
          ...u,
          settings: {
            ...u.settings,
            fieldTemplates: {
              personagem: ['Idade', 'Profissão', 'Família', 'O que deseja', 'O que a machucou'],
              lugar: ['Cidade', 'Bairro', 'Atmosfera', 'Quem mora ali'],
            },
          },
        },
        'Primeira parte',
      ),
  },
  {
    id: 'rpg',
    label: 'Campanha de RPG',
    short: 'Mesa d20 e sessão 1',
    hint: 'Uma mesa com sistema estilo d20, a sessão 1 e uma tabela de rumores.',
    apply: (u) => {
      u = { ...u, settings: { ...u.settings, calendarSuffix: 'DC', fieldTemplates: { ...FANTASY_FIELDS, personagem: ['Classe', 'Jogador', 'Objetivo', 'Ganchos', 'Segredo'] } } }
      let system
      ;[u, system] = insert(u, 'systems', systemFromTemplate('d20-5e'))
      let group
      ;[u, group] = insert(u, 'groups', draftGroup('Minha mesa', system.id))
      ;[u] = insert(u, 'sessions', { ...draftSession(1, group.id), title: 'Sessão 1', prep: 'Onde a história começa? Quem os jogadores encontram primeiro?' })
      ;[u] = insert(u, 'tables', { name: 'Rumores da taverna', entries: ['Alguém viu luzes na torre abandonada.', 'O ferreiro está devendo para a guilda.', 'Um mercador procura escolta, pagando bem.', 'Ninguém volta da floresta ao norte.'] })
      return u
    },
  },
]

/** Aplica o modelo escolhido a um universo novo. */
export function applyTemplate(u: Universe, id: UniverseTemplate['id']): Universe {
  const t = UNIVERSE_TEMPLATES.find((x) => x.id === id)
  return t ? t.apply(u) : u
}
