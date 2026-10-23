import type {
  AtlasMap,
  CollectionKey,
  Entity,
  Fact,
  Group,
  InboxItem,
  Knowledge,
  RecordOf,
  Relation,
  Revelation,
  Scene,
  SceneDoc,
  Seed,
  Session,
  Story,
  TimelineEvent,
  Universe,
} from './schema'

/** Operações puras sobre o universo. Nunca alteram o objeto recebido. */

export const EMPTY_DOC: SceneDoc = { type: 'doc', content: [{ type: 'paragraph' }] }

export const now = () => new Date().toISOString()
export const newId = () => crypto.randomUUID()

export function createUniverse(name = 'Meu universo'): Universe {
  const t = now()
  return {
    id: newId(),
    name,
    description: '',
    stories: [],
    scenes: [],
    entities: [],
    relations: [],
    events: [],
    facts: [],
    knowledge: [],
    seeds: [],
    groups: [],
    sessions: [],
    revelations: [],
    inbox: [],
    maps: [],
    continuity: [],
    systems: [],
    sheets: [],
    tables: [],
    settings: { calendarSuffix: '', dailyWordGoal: 0, ignoredNames: [] },
    dailyStart: {},
    createdAt: t,
    updatedAt: t,
  }
}

// ---------------------------------------------------------------------------
// Coleções genéricas

type Draft<K extends CollectionKey> = Omit<RecordOf<K>, 'id' | 'createdAt' | 'updatedAt'>

export function insert<K extends CollectionKey>(
  universe: Universe,
  key: K,
  draft: Draft<K>,
): [Universe, RecordOf<K>] {
  const t = now()
  const record = { ...draft, id: newId(), createdAt: t, updatedAt: t } as RecordOf<K>
  const list = universe[key] as RecordOf<K>[]
  return [{ ...universe, [key]: [...list, record], updatedAt: t }, record]
}

export function patch<K extends CollectionKey>(
  universe: Universe,
  key: K,
  id: string,
  changes: Partial<Draft<K>>,
): Universe {
  const t = now()
  const list = universe[key] as RecordOf<K>[]
  return {
    ...universe,
    [key]: list.map((r) => (r.id === id ? { ...r, ...changes, updatedAt: t } : r)),
    updatedAt: t,
  }
}

export function remove<K extends CollectionKey>(universe: Universe, key: K, id: string): Universe {
  const list = universe[key] as RecordOf<K>[]
  return { ...universe, [key]: list.filter((r) => r.id !== id), updatedAt: now() }
}

export function byId<K extends CollectionKey>(
  universe: Universe,
  key: K,
  id: string | null | undefined,
): RecordOf<K> | undefined {
  if (!id) return undefined
  return (universe[key] as RecordOf<K>[]).find((r) => r.id === id)
}

// ---------------------------------------------------------------------------
// Rascunhos padrão de cada tipo de registro

export const draftEntity = (kind: string, name: string): Draft<'entities'> => ({
  kind,
  name,
  aliases: [],
  summary: '',
  description: '',
  tags: [],
  canon: 'estabelecido',
  editorial: 'rascunho',
  parentId: null,
  startYear: null,
  endYear: null,
  fields: [],
})

export const draftRelation = (fromId: string, toId: string, type: string): Draft<'relations'> => ({
  fromId,
  toId,
  type,
  note: '',
  canon: 'estabelecido',
})

export const draftEvent = (title: string, year: number): Draft<'events'> => ({
  title,
  kind: 'evento',
  year,
  endYear: null,
  description: '',
  entityIds: [],
  placeId: null,
  importance: 2,
  canon: 'estabelecido',
})

export const draftFact = (fields: Partial<Draft<'facts'>> = {}): Draft<'facts'> => ({
  subjectId: null,
  predicate: '',
  value: '',
  objectId: null,
  speakerId: null,
  sourceSceneId: null,
  quote: '',
  canon: 'estabelecido',
  editorial: 'provisorio',
  note: '',
  ...fields,
})

export const draftSeed = (title: string, kind: Seed['kind'] = 'semente'): Draft<'seeds'> => ({
  kind,
  title,
  description: '',
  status: 'aberta',
  setupSceneId: null,
  payoffSceneId: null,
  entityIds: [],
  clues: [],
})

export const draftSession = (number: number, groupId: string | null): Draft<'sessions'> => ({
  number,
  title: `Sessão ${number}`,
  playedOn: new Date().toISOString().slice(0, 10),
  groupId,
  status: 'planejada',
  prep: '',
  log: [],
  initiative: [],
  turn: 0,
  round: 1,
})

export const draftInbox = (
  text: string,
  source: InboxItem['source'] = 'captura',
  sourceName = '',
): Draft<'inbox'> => ({ text, source, sourceName, status: 'aberto' })

export const draftKnowledge = (holderId: string, factId: string): Draft<'knowledge'> => ({
  holderId,
  factId,
  state: 'sabe',
  sinceSceneId: null,
  note: '',
})

export const draftRevelation = (
  groupId: string,
  target: Revelation['target'],
  targetId: string,
  sessionId: string | null,
): Draft<'revelations'> => ({
  groupId,
  target,
  targetId,
  depth: target === 'entidade' ? 'resumo' : 'completo',
  sessionId,
})

export const draftGroup = (name: string, systemId: string | null = null): Draft<'groups'> => ({ name, systemId })

export const draftMap = (name: string, image: string, width: number, height: number): Draft<'maps'> => ({
  name,
  image,
  width,
  height,
  pins: [],
})

// ---------------------------------------------------------------------------
// Manuscrito

export function scenesOf(universe: Universe, storyId: string | null): Scene[] {
  return universe.scenes.filter((s) => s.storyId === storyId).sort((a, b) => a.order - b.order)
}

/** Todas as cenas na ordem de leitura: histórias em ordem, depois as cenas soltas. */
export function manuscriptOrder(universe: Universe): Scene[] {
  return [...universe.stories.flatMap((s) => scenesOf(universe, s.id)), ...scenesOf(universe, null)]
}

export function addStory(universe: Universe, title = 'Nova história'): [Universe, Story] {
  return insert(universe, 'stories', { title, synopsis: '' })
}

export function renameStory(universe: Universe, storyId: string, title: string): Universe {
  return patch(universe, 'stories', storyId, { title })
}

/** Remove a história. Suas cenas não são apagadas: viram cenas soltas. */
export function removeStory(universe: Universe, storyId: string): Universe {
  const t = now()
  let order = nextOrder(universe, null)
  return {
    ...universe,
    stories: universe.stories.filter((s) => s.id !== storyId),
    scenes: universe.scenes.map((s) =>
      s.storyId === storyId ? { ...s, storyId: null, order: order++, updatedAt: t } : s,
    ),
    updatedAt: t,
  }
}

export function addScene(
  universe: Universe,
  storyId: string | null,
  title = 'Nova cena',
): [Universe, Scene] {
  return insert(universe, 'scenes', {
    title,
    storyId,
    order: nextOrder(universe, storyId),
    doc: EMPTY_DOC,
    text: '',
    synopsis: '',
    status: 'rascunho',
    povId: null,
    placeId: null,
    date: null,
    presentIds: [],
    notes: '',
    versions: [],
  })
}

export function updateScene(
  universe: Universe,
  sceneId: string,
  changes: Partial<Omit<Scene, 'id' | 'createdAt' | 'updatedAt'>>,
): Universe {
  return patch(universe, 'scenes', sceneId, changes)
}

export function removeScene(universe: Universe, sceneId: string): Universe {
  const clear = (v: string | null) => (v === sceneId ? null : v)
  return {
    ...remove(universe, 'scenes', sceneId),
    facts: universe.facts.map((f) => ({ ...f, sourceSceneId: clear(f.sourceSceneId) })),
    knowledge: universe.knowledge.map((k) => ({ ...k, sinceSceneId: clear(k.sinceSceneId) })),
    seeds: universe.seeds.map((s) => ({
      ...s,
      setupSceneId: clear(s.setupSceneId),
      payoffSceneId: clear(s.payoffSceneId),
      clues: s.clues.map((c) => ({ ...c, sceneId: clear(c.sceneId) })),
    })),
  }
}

/** Guarda o texto atual da cena como uma versão nomeada. */
export function saveSceneVersion(universe: Universe, sceneId: string, name: string): Universe {
  const scene = byId(universe, 'scenes', sceneId)
  if (!scene) return universe
  const version = { id: newId(), name, at: now(), doc: scene.doc, text: scene.text }
  return patch(universe, 'scenes', sceneId, { versions: [version, ...scene.versions] })
}

/** Troca o texto da cena por uma versão, guardando antes o texto atual. */
export function restoreSceneVersion(universe: Universe, sceneId: string, versionId: string): Universe {
  const scene = byId(universe, 'scenes', sceneId)
  const version = scene?.versions.find((v) => v.id === versionId)
  if (!scene || !version) return universe
  const saved = saveSceneVersion(universe, sceneId, `Antes de voltar para “${version.name}”`)
  return patch(saved, 'scenes', sceneId, { doc: version.doc, text: version.text })
}

/** Move a cena uma posição para cima (-1) ou para baixo (+1) dentro do seu grupo. */
export function moveScene(universe: Universe, sceneId: string, direction: -1 | 1): Universe {
  const scene = byId(universe, 'scenes', sceneId)
  if (!scene) return universe
  const siblings = scenesOf(universe, scene.storyId)
  const i = siblings.findIndex((s) => s.id === sceneId)
  const other = siblings[i + direction]
  if (!other) return universe
  return patch(patch(universe, 'scenes', scene.id, { order: other.order }), 'scenes', other.id, {
    order: scene.order,
  })
}

/** Move a cena para outra história (ou para as cenas soltas), no fim da lista. */
export function moveSceneTo(universe: Universe, sceneId: string, storyId: string | null): Universe {
  return patch(universe, 'scenes', sceneId, { storyId, order: nextOrder(universe, storyId) })
}

function nextOrder(universe: Universe, storyId: string | null): number {
  const orders = universe.scenes.filter((s) => s.storyId === storyId).map((s) => s.order)
  return orders.length ? Math.max(...orders) + 1 : 0
}

// ---------------------------------------------------------------------------
// Fichas

/**
 * Remove uma ficha e as referências a ela. Relações e conhecimentos que só
 * existem por causa dela também saem; os demais registros ficam, sem o vínculo.
 */
export function removeEntity(universe: Universe, entityId: string): Universe {
  const clear = (v: string | null) => (v === entityId ? null : v)
  const without = (ids: string[]) => ids.filter((x) => x !== entityId)
  const t = now()
  return {
    ...universe,
    entities: universe.entities
      .filter((e) => e.id !== entityId)
      .map((e) => (e.parentId === entityId ? { ...e, parentId: null } : e)),
    relations: universe.relations.filter((r) => r.fromId !== entityId && r.toId !== entityId),
    scenes: universe.scenes.map((s) => ({
      ...s,
      povId: clear(s.povId),
      placeId: clear(s.placeId),
      presentIds: without(s.presentIds),
    })),
    events: universe.events.map((e) => ({
      ...e,
      entityIds: without(e.entityIds),
      placeId: clear(e.placeId),
    })),
    facts: universe.facts.map((f) => ({
      ...f,
      subjectId: clear(f.subjectId),
      objectId: clear(f.objectId),
      speakerId: clear(f.speakerId),
    })),
    knowledge: universe.knowledge.filter((k) => k.holderId !== entityId),
    seeds: universe.seeds.map((s) => ({ ...s, entityIds: without(s.entityIds) })),
    revelations: universe.revelations.filter(
      (r) => !(r.target === 'entidade' && r.targetId === entityId),
    ),
    maps: universe.maps.map((m) => ({ ...m, pins: m.pins.filter((p) => p.entityId !== entityId) })),
    sheets: universe.sheets.map((s) => (s.entityId === entityId ? { ...s, entityId: null } : s)),
    updatedAt: t,
  }
}

export function removeFact(universe: Universe, factId: string): Universe {
  return {
    ...remove(universe, 'facts', factId),
    knowledge: universe.knowledge.filter((k) => k.factId !== factId),
    revelations: universe.revelations.filter((r) => !(r.target === 'fato' && r.targetId === factId)),
  }
}

export function removeGroup(universe: Universe, groupId: string): Universe {
  return {
    ...remove(universe, 'groups', groupId),
    sheets: universe.sheets.map((s) => (s.groupId === groupId ? { ...s, groupId: null } : s)),
    sessions: universe.sessions.map((s) => (s.groupId === groupId ? { ...s, groupId: null } : s)),
    revelations: universe.revelations.filter((r) => r.groupId !== groupId),
  }
}

export function removeSession(universe: Universe, sessionId: string): Universe {
  return {
    ...remove(universe, 'sessions', sessionId),
    revelations: universe.revelations.map((r) =>
      r.sessionId === sessionId ? { ...r, sessionId: null } : r,
    ),
  }
}

/** Remove um sistema; mesas e fichas de jogo que o usavam ficam sem sistema. */
export function removeSystem(universe: Universe, systemId: string): Universe {
  return {
    ...remove(universe, 'systems', systemId),
    groups: universe.groups.map((g) => (g.systemId === systemId ? { ...g, systemId: null } : g)),
    sheets: universe.sheets.map((s) => (s.systemId === systemId ? { ...s, systemId: null } : s)),
  }
}

/** Remove uma ficha de jogo e tira o vínculo das iniciativas. */
export function removeSheet(universe: Universe, sheetId: string): Universe {
  return {
    ...remove(universe, 'sheets', sheetId),
    sessions: universe.sessions.map((s) => ({
      ...s,
      initiative: s.initiative.map((i) => (i.sheetId === sheetId ? { ...i, sheetId: null } : i)),
    })),
  }
}

/** Nome de exibição de uma ficha. */
export function entityName(universe: Universe, id: string | null | undefined): string {
  const e = byId(universe, 'entities', id)
  return e ? e.name || 'Sem nome' : ''
}

/** Todos os nomes pelos quais a entidade aparece. */
export function namesOf(entity: Entity): string[] {
  return [entity.name, ...entity.aliases].map((n) => n.trim()).filter(Boolean)
}

/** Uma cópia completa do universo com novo ID, para explorar um "E se…?". */
export function forkUniverse(universe: Universe, name: string): Universe {
  const t = now()
  return { ...structuredClone(universe), id: newId(), name, createdAt: t, updatedAt: t }
}

export type {
  AtlasMap,
  Entity,
  Fact,
  Group,
  InboxItem,
  Knowledge,
  Relation,
  Revelation,
  Scene,
  Seed,
  Session,
  Story,
  TimelineEvent,
  Universe,
}
