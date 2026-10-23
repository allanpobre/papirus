import { z } from 'zod'

/** Versão atual do formato salvo. Toda mudança de formato exige uma migração em `migrations.ts`. */
export const CURRENT_SCHEMA_VERSION = 2

const id = z.string().min(1)
const ref = id.nullable()
const timestamps = { createdAt: z.string(), updatedAt: z.string() }

/** Natureza da informação dentro do universo. */
export const CANON_STATES = [
  'estabelecido',
  'rumor',
  'lenda',
  'disputado',
  'secreto',
  'falso',
  'desconhecido',
] as const
export const canonSchema = z.enum(CANON_STATES)

/** Maturidade do conteúdo para o autor; independente do canon. */
export const EDITORIAL_STATES = ['rascunho', 'provisorio', 'definido', 'nao-decidido'] as const
export const editorialSchema = z.enum(EDITORIAL_STATES)

/**
 * Documento de uma cena no formato JSON do editor (ProseMirror/TipTap).
 * Validamos apenas a forma mínima; o conteúdo interno pertence ao editor.
 */
export const sceneDocSchema = z.looseObject({
  type: z.literal('doc'),
  content: z.array(z.looseObject({ type: z.string() })).optional(),
})

/** Data narrativa: ano do calendário do universo e, opcionalmente, o dia. */
export const narrativeDateSchema = z.object({
  year: z.number(),
  day: z.number().nullable(),
})

export const storySchema = z.object({
  id,
  title: z.string(),
  synopsis: z.string(),
  ...timestamps,
})

export const SCENE_STATUSES = ['ideia', 'rascunho', 'revisao', 'pronta'] as const

export const sceneSchema = z.object({
  id,
  title: z.string(),
  /** `null` = cena solta, sem história. */
  storyId: ref,
  /** Ordem dentro da história (ou entre as cenas soltas). */
  order: z.number(),
  doc: sceneDocSchema,
  /** Projeção em texto puro do documento, usada em busca e detecção. */
  text: z.string(),
  synopsis: z.string(),
  status: z.enum(SCENE_STATUSES),
  povId: ref,
  placeId: ref,
  date: narrativeDateSchema.nullable(),
  /** Elenco presente na cena, registrado pelo autor. */
  presentIds: z.array(id),
  notes: z.string(),
  /** Versões guardadas do texto, para comparar e voltar atrás. */
  versions: z
    .array(z.object({ id, name: z.string(), at: z.string(), doc: sceneDocSchema, text: z.string() }))
    .default([]),
  /** Comentários do autor presos a trechos do texto (marca `comment` no documento). */
  comments: z
    .array(z.object({ id, text: z.string(), quote: z.string(), resolved: z.boolean(), at: z.string() }))
    .default([]),
  ...timestamps,
})

/** Tipos de ficha. O autor também pode usar tipos próprios (texto livre). */
export const ENTITY_KINDS = [
  'personagem',
  'lugar',
  'faccao',
  'cultura',
  'religiao',
  'magia',
  'artefato',
  'especie',
  'reino',
  'conceito',
] as const

export const entityFieldSchema = z.object({ key: z.string(), value: z.string() })

export const entitySchema = z.object({
  id,
  kind: z.string().min(1),
  name: z.string(),
  /** Outros nomes, títulos, epítetos e identidades pelas quais a entidade aparece. */
  aliases: z.array(z.string()),
  summary: z.string(),
  description: z.string(),
  tags: z.array(z.string()),
  canon: canonSchema,
  editorial: editorialSchema,
  /** Lugar ou entidade que contém esta (cidade dentro de reino, etc.). */
  parentId: ref,
  /** Início e fim da existência (nascimento/fundação e morte/queda), em anos do universo. */
  startYear: z.number().nullable(),
  endYear: z.number().nullable(),
  fields: z.array(entityFieldSchema),
  ...timestamps,
})

export const RELATION_SCOPES = ['geral', 'periodo', 'historia', 'cenas'] as const

/** Quando uma relação vale: sempre, num intervalo de anos, numa história/arco ou em cenas específicas. */
export const relationScopeSchema = z.object({
  kind: z.enum(RELATION_SCOPES),
  fromYear: z.number().nullable(),
  toYear: z.number().nullable(),
  storyIds: z.array(id),
  sceneIds: z.array(id),
})

export const relationSchema = z.object({
  id,
  fromId: id,
  toId: id,
  /** Tipo livre: "irmão de", "serve a", "rival de"… */
  type: z.string(),
  note: z.string(),
  canon: canonSchema,
  /**
   * Quem está por trás ou junto, com o papel em texto livre:
   * "Luan envenenou João, a mando de José" → via = [{ José, "a mando de" }].
   */
  via: z.array(z.object({ entityId: id, role: z.string() })).default([]),
  scope: relationScopeSchema.default({ kind: 'geral', fromYear: null, toYear: null, storyIds: [], sceneIds: [] }),
  ...timestamps,
})

export const eventSchema = z.object({
  id,
  title: z.string(),
  /** `era` desenha uma faixa na Timeline. */
  kind: z.enum(['evento', 'era']),
  year: z.number(),
  endYear: z.number().nullable(),
  description: z.string(),
  entityIds: z.array(id),
  placeId: ref,
  importance: z.number().int().min(1).max(3),
  canon: canonSchema,
  ...timestamps,
})

/** Um fato capturado: sujeito · relação · valor, com a fonte no texto. */
export const factSchema = z.object({
  id,
  subjectId: ref,
  predicate: z.string(),
  /** Valor como texto livre, ou uma ficha (`objectId`). */
  value: z.string(),
  objectId: ref,
  /** Quem afirma. `null` = narrador/autor. */
  speakerId: ref,
  sourceSceneId: ref,
  quote: z.string(),
  canon: canonSchema,
  editorial: editorialSchema,
  note: z.string(),
  ...timestamps,
})

export const KNOWLEDGE_STATES = ['sabe', 'suspeita', 'acredita', 'esqueceu'] as const

/** O que um personagem ou grupo sabe, suspeita ou acredita. */
export const knowledgeSchema = z.object({
  id,
  holderId: id,
  factId: id,
  state: z.enum(KNOWLEDGE_STATES),
  /** A partir de qual cena. `null` = desde sempre. */
  sinceSceneId: ref,
  note: z.string(),
  ...timestamps,
})

export const SEED_STATUSES = ['aberta', 'parcial', 'resolvida', 'abandonada'] as const

export const seedSchema = z.object({
  id,
  kind: z.enum(['semente', 'misterio']),
  title: z.string(),
  description: z.string(),
  status: z.enum(SEED_STATUSES),
  setupSceneId: ref,
  payoffSceneId: ref,
  entityIds: z.array(id),
  clues: z.array(z.object({ id, text: z.string(), sceneId: ref })),
  ...timestamps,
})

export const groupSchema = z.object({
  id,
  name: z.string(),
  /** Sistema de jogo da mesa. `null` = sem sistema. */
  systemId: ref.default(null),
  /** Mostrar as fichas dos personagens dos jogadores no Codex da mesa. */
  showSheetsInCodex: z.boolean().default(true),
  /** Codex ao vivo: id público (vai no link) e chave secreta do mestre. `null` = não compartilha. */
  share: z.object({ id, key: z.string() }).nullable().default(null),
  ...timestamps,
})

/** Como o resultado de uma rolagem é lido. */
export const RESOLUTION_MODES = ['total', 'sucessos', 'abaixo'] as const
/** Como um atributo vira modificador. */
export const MODIFIER_RULES = ['nenhum', 'direto', 'd20'] as const

/**
 * Sistema de jogo editável: atributos, recursos, perícias, fórmulas de rolagem e
 * condições. Pode nascer de um modelo pronto ou do zero.
 */
export const gameSystemSchema = z.object({
  id,
  name: z.string(),
  /** Modelo de origem, só para referência. */
  template: z.string().nullable(),
  attributes: z.array(
    z.object({ id, abbr: z.string(), name: z.string(), default: z.number(), min: z.number(), max: z.number() }),
  ),
  modifierRule: z.enum(MODIFIER_RULES),
  resources: z.array(z.object({ id, abbr: z.string(), name: z.string(), default: z.number() })),
  skills: z.array(z.object({ id, name: z.string(), attributeId: ref })),
  /** Fórmulas com marcadores: {atr}, {mod}, {per}, {SIGLA}, {mod:SIGLA}. */
  skillFormula: z.string(),
  attributeFormula: z.string(),
  initiativeFormula: z.string(),
  resolution: z.enum(RESOLUTION_MODES),
  /** No modo "sucessos": valor mínimo de um dado para contar como sucesso. */
  successTarget: z.number().int(),
  /** Zero (ou menos) dados vira "rola 2 e fica com o pior". */
  zeroDiceRule: z.boolean(),
  conditions: z.array(z.string()),
  /** Campos de texto da ficha: classe, origem, trilha… */
  fields: z.array(z.string()),
  /** Partes da mesa que este sistema usa. */
  features: z.object({
    initiative: z.boolean(),
    resources: z.boolean(),
    conditions: z.boolean(),
    rollLog: z.boolean(),
  }),
  ...timestamps,
})

/** Ficha de jogo de um personagem de jogador ou NPC, ligada (ou não) a uma ficha do mundo. */
export const sheetSchema = z.object({
  id,
  name: z.string(),
  role: z.enum(['pj', 'npc']),
  player: z.string(),
  entityId: ref,
  groupId: ref,
  systemId: ref,
  attributes: z.record(z.string(), z.number()),
  resources: z.record(z.string(), z.object({ current: z.number(), max: z.number() })),
  skills: z.record(z.string(), z.number()),
  conditions: z.array(z.string()),
  fields: z.record(z.string(), z.string()),
  notes: z.string(),
  ...timestamps,
})

/** Tabela aleatória do mestre: nomes, rumores, encontros… */
export const randomTableSchema = z.object({
  id,
  name: z.string(),
  entries: z.array(z.string()),
  ...timestamps,
})

export const SESSION_STATUSES = ['planejada', 'em-andamento', 'encerrada'] as const

export const sessionSchema = z.object({
  id,
  number: z.number().int(),
  title: z.string(),
  /** Data real da sessão de jogo (AAAA-MM-DD). */
  playedOn: z.string(),
  groupId: ref,
  status: z.enum(SESSION_STATUSES),
  prep: z.string(),
  log: z.array(
    z.object({ id, at: z.string(), text: z.string(), kind: z.enum(['nota', 'rolagem']).default('nota') }),
  ),
  initiative: z.array(
    z.object({
      id,
      name: z.string(),
      value: z.number(),
      hp: z.string(),
      note: z.string(),
      /** Ficha de jogo ligada, para recursos e condições. */
      sheetId: ref.default(null),
    }),
  ),
  /** Posição na ordem de iniciativa e número da rodada. */
  turn: z.number().int().nonnegative().default(0),
  round: z.number().int().positive().default(1),
  ...timestamps,
})

/** Algo revelado a um grupo de jogadores: uma ficha (nome ou ficha completa) ou um fato. */
export const revelationSchema = z.object({
  id,
  groupId: id,
  /**
   * O que foi revelado: uma ficha, um fato, um evento da timeline, uma pista de
   * mistério, um mapa (só a imagem) ou um marcador de mapa.
   */
  target: z.enum(['entidade', 'fato', 'evento', 'pista', 'mapa', 'marcador']),
  targetId: id,
  /** Para fichas: revelar só o nome, o resumo, ou também a descrição. */
  depth: z.enum(['nome', 'resumo', 'completo']),
  sessionId: ref,
  ...timestamps,
})

export const inboxItemSchema = z.object({
  id,
  text: z.string(),
  source: z.enum(['captura', 'arquivo', 'sessao']),
  sourceName: z.string(),
  status: z.enum(['aberto', 'processado', 'arquivado']),
  ...timestamps,
})

export const atlasMapSchema = z.object({
  id,
  name: z.string(),
  image: z.string(),
  width: z.number(),
  height: z.number(),
  pins: z.array(
    z.object({ id, entityId: id, x: z.number(), y: z.number(), label: z.string() }),
  ),
  ...timestamps,
})

export const CONTINUITY_ANSWERS = ['erro', 'intencional', 'explicacao', 'depois'] as const

export const continuityAnswerSchema = z.object({
  /** Assinatura da pergunta (tipo + cenas + ficha). */
  key: z.string(),
  answer: z.enum(CONTINUITY_ANSWERS),
  note: z.string(),
  at: z.string(),
})

export const universeSettingsSchema = z.object({
  /** Rótulo depois do ano: "DC", "da Coroa"… */
  calendarSuffix: z.string(),
  dailyWordGoal: z.number().int().nonnegative(),
  /** Palavras que a descoberta de nomes deve ignorar. */
  ignoredNames: z.array(z.string()),
  /** Meses do calendário do universo. Vazio = só o ano e o dia do ano. */
  calendarMonths: z.array(z.object({ name: z.string(), days: z.number().int().positive() })).default([]),
})

export const universeSchema = z.object({
  id,
  name: z.string(),
  description: z.string(),
  stories: z.array(storySchema),
  scenes: z.array(sceneSchema),
  entities: z.array(entitySchema),
  relations: z.array(relationSchema),
  events: z.array(eventSchema),
  facts: z.array(factSchema),
  knowledge: z.array(knowledgeSchema),
  seeds: z.array(seedSchema),
  groups: z.array(groupSchema),
  sessions: z.array(sessionSchema),
  revelations: z.array(revelationSchema),
  inbox: z.array(inboxItemSchema),
  maps: z.array(atlasMapSchema),
  continuity: z.array(continuityAnswerSchema),
  systems: z.array(gameSystemSchema).default([]),
  sheets: z.array(sheetSchema).default([]),
  tables: z.array(randomTableSchema).default([]),
  settings: universeSettingsSchema,
  /** Total de palavras no início de cada dia (AAAA-MM-DD), para metas diárias. */
  dailyStart: z.record(z.string(), z.number()),
  ...timestamps,
})

export const savedFileSchema = z.object({
  schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
  /** Incrementa a cada salvamento; base para controle de revisão. */
  revision: z.number().int().nonnegative(),
  universe: universeSchema,
})

export type Canon = z.infer<typeof canonSchema>
export type Editorial = z.infer<typeof editorialSchema>
export type SceneDoc = z.infer<typeof sceneDocSchema>
export type NarrativeDate = z.infer<typeof narrativeDateSchema>
export type Story = z.infer<typeof storySchema>
export type Scene = z.infer<typeof sceneSchema>
export type SceneVersion = Scene['versions'][number]
export type SceneComment = Scene['comments'][number]
export type SceneStatus = Scene['status']
export type Entity = z.infer<typeof entitySchema>
export type Relation = z.infer<typeof relationSchema>
export type TimelineEvent = z.infer<typeof eventSchema>
export type Fact = z.infer<typeof factSchema>
export type Knowledge = z.infer<typeof knowledgeSchema>
export type KnowledgeState = Knowledge['state']
export type Seed = z.infer<typeof seedSchema>
export type SeedStatus = Seed['status']
export type Group = z.infer<typeof groupSchema>
export type Session = z.infer<typeof sessionSchema>
export type Revelation = z.infer<typeof revelationSchema>
export type GameSystem = z.infer<typeof gameSystemSchema>
export type Sheet = z.infer<typeof sheetSchema>
export type RandomTable = z.infer<typeof randomTableSchema>
export type InboxItem = z.infer<typeof inboxItemSchema>
export type AtlasMap = z.infer<typeof atlasMapSchema>
export type ContinuityAnswer = z.infer<typeof continuityAnswerSchema>
export type Universe = z.infer<typeof universeSchema>
export type SavedFile = z.infer<typeof savedFileSchema>

/** Coleções do universo que guardam registros com `id`. */
export type CollectionKey =
  | 'stories'
  | 'scenes'
  | 'entities'
  | 'relations'
  | 'events'
  | 'facts'
  | 'knowledge'
  | 'seeds'
  | 'groups'
  | 'sessions'
  | 'revelations'
  | 'inbox'
  | 'maps'
  | 'systems'
  | 'sheets'
  | 'tables'
export type RecordOf<K extends CollectionKey> = Universe[K][number]
