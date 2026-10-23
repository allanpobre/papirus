import type { GameSystem } from '../model/schema'
import { newId, now } from '../model/universe'

type SystemDraft = Omit<GameSystem, 'id' | 'createdAt' | 'updatedAt'>

interface TemplateSpec {
  id: string
  name: string
  description: string
  attributes: [abbr: string, name: string][]
  attrDefault: number
  attrMin: number
  attrMax: number
  modifierRule: GameSystem['modifierRule']
  resources: [abbr: string, name: string, def: number][]
  /** Perícia e sigla do atributo ligado (ou null). */
  skills: [name: string, attr: string | null][]
  skillFormula: string
  attributeFormula: string
  initiativeFormula: string
  resolution: GameSystem['resolution']
  successTarget?: number
  zeroDiceRule?: boolean
  conditions: string[]
  fields: string[]
}

/**
 * Modelos de partida. São só a estrutura (nomes de atributos, fórmulas e
 * condições), sem texto de livros. Tudo é editável depois de criado.
 */
const TEMPLATES: TemplateSpec[] = [
  {
    id: 'narrativo',
    name: 'Sem sistema (narrativo)',
    description: 'Só vida e anotações. Bom para jogos leves ou sistemas que você ainda vai montar.',
    attributes: [],
    attrDefault: 0,
    attrMin: 0,
    attrMax: 10,
    modifierRule: 'nenhum',
    resources: [['PV', 'Vida', 10]],
    skills: [],
    skillFormula: '1d20+{per}',
    attributeFormula: '1d20+{atr}',
    initiativeFormula: '1d20',
    resolution: 'total',
    conditions: ['Ferido', 'Exausto', 'Assustado', 'Inconsciente'],
    fields: ['Conceito', 'Objetivo'],
  },
  {
    id: 'd20-5e',
    name: 'Estilo D&D 5e (d20)',
    description: 'Seis atributos de 3 a 20 com modificador, bônus de proficiência nas perícias, 1d20 contra uma CD.',
    attributes: [
      ['FOR', 'Força'],
      ['DES', 'Destreza'],
      ['CON', 'Constituição'],
      ['INT', 'Inteligência'],
      ['SAB', 'Sabedoria'],
      ['CAR', 'Carisma'],
    ],
    attrDefault: 10,
    attrMin: 1,
    attrMax: 30,
    modifierRule: 'd20',
    resources: [
      ['PV', 'Pontos de vida', 10],
      ['CA', 'Classe de armadura', 10],
    ],
    skills: [
      ['Acrobacia', 'DES'], ['Arcanismo', 'INT'], ['Atletismo', 'FOR'], ['Atuação', 'CAR'], ['Enganação', 'CAR'],
      ['Furtividade', 'DES'], ['História', 'INT'], ['Intimidação', 'CAR'], ['Intuição', 'SAB'], ['Investigação', 'INT'],
      ['Lidar com animais', 'SAB'], ['Medicina', 'SAB'], ['Natureza', 'INT'], ['Percepção', 'SAB'], ['Persuasão', 'CAR'],
      ['Prestidigitação', 'DES'], ['Religião', 'INT'], ['Sobrevivência', 'SAB'],
    ],
    skillFormula: '1d20+{mod}+{per}',
    attributeFormula: '1d20+{mod}',
    initiativeFormula: '1d20+{mod:DES}',
    resolution: 'total',
    conditions: ['Agarrado', 'Amedrontado', 'Atordoado', 'Caído', 'Cego', 'Enfeitiçado', 'Envenenado', 'Exausto', 'Impedido', 'Incapacitado', 'Inconsciente', 'Invisível', 'Paralisado', 'Petrificado', 'Surdo'],
    fields: ['Classe e nível', 'Raça', 'Antecedente', 'Alinhamento'],
  },
  {
    id: 't20',
    name: 'Estilo Tormenta 20',
    description: 'Atributos já são o modificador, perícias com bônus de treino, 1d20 + atributo + perícia.',
    attributes: [
      ['FOR', 'Força'],
      ['DES', 'Destreza'],
      ['CON', 'Constituição'],
      ['INT', 'Inteligência'],
      ['SAB', 'Sabedoria'],
      ['CAR', 'Carisma'],
    ],
    attrDefault: 0,
    attrMin: -5,
    attrMax: 10,
    modifierRule: 'direto',
    resources: [
      ['PV', 'Pontos de vida', 12],
      ['PM', 'Pontos de mana', 4],
      ['DEF', 'Defesa', 10],
    ],
    skills: [
      ['Acrobacia', 'DES'], ['Adestramento', 'CAR'], ['Atletismo', 'FOR'], ['Atuação', 'CAR'], ['Cavalgar', 'DES'],
      ['Conhecimento', 'INT'], ['Cura', 'SAB'], ['Diplomacia', 'CAR'], ['Enganação', 'CAR'], ['Fortitude', 'CON'],
      ['Furtividade', 'DES'], ['Guerra', 'INT'], ['Iniciativa', 'DES'], ['Intimidação', 'CAR'], ['Intuição', 'SAB'],
      ['Investigação', 'INT'], ['Jogatina', 'CAR'], ['Ladinagem', 'DES'], ['Luta', 'FOR'], ['Misticismo', 'INT'],
      ['Nobreza', 'INT'], ['Ofício', 'INT'], ['Percepção', 'SAB'], ['Pilotagem', 'DES'], ['Pontaria', 'DES'],
      ['Reflexos', 'DES'], ['Religião', 'SAB'], ['Sobrevivência', 'SAB'], ['Vontade', 'SAB'],
    ],
    skillFormula: '1d20+{atr}+{per}',
    attributeFormula: '1d20+{atr}',
    initiativeFormula: '1d20+{DES}+{per:Iniciativa}',
    resolution: 'total',
    conditions: ['Abalado', 'Agarrado', 'Alquebrado', 'Apavorado', 'Atordoado', 'Caído', 'Cego', 'Confuso', 'Debilitado', 'Desprevenido', 'Enjoado', 'Enredado', 'Envenenado', 'Esmorecido', 'Exausto', 'Fascinado', 'Fatigado', 'Fraco', 'Frustrado', 'Imóvel', 'Inconsciente', 'Lento', 'Ofuscado', 'Paralisado', 'Pasmo', 'Sangrando', 'Surdo', 'Surpreendido', 'Vulnerável'],
    fields: ['Raça', 'Classe e nível', 'Origem', 'Divindade'],
  },
  {
    id: 'op',
    name: 'Estilo Ordem Paranormal',
    description: 'Cinco atributos de 0 a 5 que dizem quantos d20 rolar (fica o maior); sem dados, rola 2 e fica o pior.',
    attributes: [
      ['AGI', 'Agilidade'],
      ['FOR', 'Força'],
      ['INT', 'Intelecto'],
      ['PRE', 'Presença'],
      ['VIG', 'Vigor'],
    ],
    attrDefault: 1,
    attrMin: 0,
    attrMax: 5,
    modifierRule: 'nenhum',
    resources: [
      ['PV', 'Pontos de vida', 20],
      ['PE', 'Pontos de esforço', 2],
      ['SAN', 'Sanidade', 12],
      ['DEF', 'Defesa', 10],
    ],
    skills: [
      ['Acrobacia', 'AGI'], ['Adestramento', 'PRE'], ['Artes', 'PRE'], ['Atletismo', 'FOR'], ['Atualidades', 'INT'],
      ['Ciências', 'INT'], ['Crime', 'AGI'], ['Diplomacia', 'PRE'], ['Enganação', 'PRE'], ['Fortitude', 'VIG'],
      ['Furtividade', 'AGI'], ['Iniciativa', 'AGI'], ['Intimidação', 'PRE'], ['Intuição', 'PRE'], ['Investigação', 'INT'],
      ['Luta', 'FOR'], ['Medicina', 'INT'], ['Ocultismo', 'INT'], ['Percepção', 'PRE'], ['Pilotagem', 'AGI'],
      ['Pontaria', 'AGI'], ['Profissão', 'INT'], ['Reflexos', 'AGI'], ['Religião', 'PRE'], ['Sobrevivência', 'INT'],
      ['Tática', 'INT'], ['Tecnologia', 'INT'], ['Vontade', 'PRE'],
    ],
    skillFormula: '{atr}d20kh1+{per}',
    attributeFormula: '{atr}d20kh1',
    initiativeFormula: '{AGI}d20kh1+{per:Iniciativa}',
    resolution: 'total',
    zeroDiceRule: true,
    conditions: ['Abalado', 'Agarrado', 'Apavorado', 'Caído', 'Cego', 'Confuso', 'Enlouquecendo', 'Enredado', 'Esmorecido', 'Exausto', 'Fatigado', 'Fraco', 'Inconsciente', 'Lento', 'Machucado', 'Morrendo', 'Paralisado', 'Surdo', 'Vulnerável'],
    fields: ['Origem', 'Classe', 'Trilha', 'NEX'],
  },
  {
    id: 'd100',
    name: 'Estilo Call of Cthulhu (d100)',
    description: 'Atributos e perícias em porcentagem; rola d100 e passa se tirar igual ou menos.',
    attributes: [
      ['FOR', 'Força'],
      ['CON', 'Constituição'],
      ['TAM', 'Tamanho'],
      ['DES', 'Destreza'],
      ['APA', 'Aparência'],
      ['INT', 'Inteligência'],
      ['POD', 'Poder'],
      ['EDU', 'Educação'],
    ],
    attrDefault: 50,
    attrMin: 0,
    attrMax: 99,
    modifierRule: 'nenhum',
    resources: [
      ['PV', 'Pontos de vida', 10],
      ['PM', 'Pontos de magia', 10],
      ['SAN', 'Sanidade', 50],
      ['SOR', 'Sorte', 50],
    ],
    skills: [
      ['Antropologia', null], ['Arqueologia', null], ['Charme', null], ['Chaveiro', null], ['Ciência', null],
      ['Contabilidade', null], ['Direito', null], ['Disfarce', null], ['Encontrar', null], ['Escalar', null],
      ['Escutar', null], ['Esquivar', null], ['Furtividade', null], ['História', null], ['Intimidação', null],
      ['Lábia', null], ['Medicina', null], ['Mitos', null], ['Natação', null], ['Ocultismo', null], ['Persuasão', null],
      ['Primeiros socorros', null], ['Psicologia', null], ['Rastrear', null], ['Usar bibliotecas', null],
    ],
    skillFormula: 'd100',
    attributeFormula: 'd100',
    initiativeFormula: '{DES}',
    resolution: 'abaixo',
    conditions: ['Ferimento grave', 'Inconsciente', 'Insanidade temporária', 'Insanidade indefinida', 'Morrendo'],
    fields: ['Ocupação', 'Idade', 'Residência'],
  },
  {
    id: 'parada',
    name: 'Parada de dados (d10, sucesso em 8+)',
    description: 'Atributo + perícia dizem quantos d10 rolar; cada 8, 9 ou 10 é um sucesso.',
    attributes: [
      ['FIS', 'Físico'],
      ['SOC', 'Social'],
      ['MEN', 'Mental'],
    ],
    attrDefault: 2,
    attrMin: 1,
    attrMax: 5,
    modifierRule: 'nenhum',
    resources: [
      ['VIT', 'Vitalidade', 7],
      ['VON', 'Força de vontade', 3],
    ],
    skills: [
      ['Briga', 'FIS'], ['Esportes', 'FIS'], ['Furtividade', 'FIS'], ['Empatia', 'SOC'], ['Persuasão', 'SOC'],
      ['Manha', 'SOC'], ['Investigação', 'MEN'], ['Ocultismo', 'MEN'], ['Medicina', 'MEN'],
    ],
    skillFormula: '{atr}d10+{per}d10',
    attributeFormula: '{atr}d10',
    initiativeFormula: '1d10+{FIS}',
    resolution: 'sucessos',
    successTarget: 8,
    conditions: ['Ferido', 'Abalado', 'Exausto', 'Em choque'],
    fields: ['Conceito', 'Virtude', 'Vício'],
  },
]

export const SYSTEM_TEMPLATES = TEMPLATES.map(({ id, name, description }) => ({ id, name, description }))

/** Cria um sistema a partir de um modelo. Cada criação gera IDs novos. */
export function systemFromTemplate(templateId: string): SystemDraft {
  const t = TEMPLATES.find((x) => x.id === templateId) ?? TEMPLATES[0]
  const attributes = t.attributes.map(([abbr, name]) => ({ id: newId(), abbr, name, default: t.attrDefault, min: t.attrMin, max: t.attrMax }))
  const byAbbr = new Map(attributes.map((a) => [a.abbr, a.id]))
  return {
    name: t.name,
    template: t.id,
    attributes,
    modifierRule: t.modifierRule,
    resources: t.resources.map(([abbr, name, def]) => ({ id: newId(), abbr, name, default: def })),
    skills: t.skills.map(([name, attr]) => ({ id: newId(), name, attributeId: attr ? (byAbbr.get(attr) ?? null) : null })),
    skillFormula: t.skillFormula,
    attributeFormula: t.attributeFormula,
    initiativeFormula: t.initiativeFormula,
    resolution: t.resolution,
    successTarget: t.successTarget ?? 6,
    zeroDiceRule: t.zeroDiceRule ?? false,
    conditions: [...t.conditions],
    fields: [...t.fields],
    features: { initiative: true, resources: true, conditions: true, rollLog: true },
  }
}

/** Um sistema completo (com ID), útil para testes e para o universo de exemplo. */
export function makeSystem(templateId: string): GameSystem {
  const t = now()
  return { ...systemFromTemplate(templateId), id: newId(), createdAt: t, updatedAt: t }
}
