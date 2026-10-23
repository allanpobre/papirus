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

export const relationSchema = z.object({
  id,
  fromId: id,
  toId: id,
  /** Tipo livre: "irmão de", "serve a", "rival de"… */
  type: z.string(),
  note: z.string(),
  canon: canonSchema,
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

export const groupSchema = z.object({ id, name: z.string(), ...timestamps })

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
  log: z.array(z.object({ id, at: z.string(), text: z.string() })),
  initiative: z.array(
    z.object({ id, name: z.string(), value: z.number(), hp: z.string(), note: z.string() }),
  ),
  ...timestamps,
})

/** Algo revelado a um grupo de jogadores: uma ficha (nome ou ficha completa) ou um fato. */
export const revelationSchema = z.object({
  id,
  groupId: id,
  target: z.enum(['entidade', 'fato']),
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
export type RecordOf<K extends CollectionKey> = Universe[K][number]
