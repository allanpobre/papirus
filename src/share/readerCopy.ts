import { hasSecretMark, stripSecrets, stripSecretsAcross } from '../logic/secrets'
import type { Universe } from '../model/schema'


/** Tira os trechos [segredo] de todo texto livre, em qualquer profundidade. */
function stripDeep<T>(value: T): T {
  if (typeof value === 'string') return (hasSecretMark(value) ? stripSecrets(value) : value) as T
  if (Array.isArray(value)) {
    // Os pedaços de texto de um parágrafo (negrito, itálico) são lidos juntos: uma marca aberta num e fechada noutro.
    const texts = value.every((n) => n && typeof n === 'object' && (n as { type?: unknown }).type === 'text' && typeof (n as { text?: unknown }).text === 'string')
    if (texts && value.length > 1) {
      const cleaned = stripSecretsAcross(value.map((n) => (n as { text: string }).text))
      return value.map((n, i) => ({ ...(n as object), text: cleaned[i] })).filter((n) => (n as { text: string }).text) as T
    }
    return value.map(stripDeep) as T
  }
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, stripDeep(v)])) as T
  return value
}

/**
 * O universo como quem só pode ver o recebe. É isto que vai para a cópia de leitura
 * no servidor: o resto nunca sai do Papirus de quem edita.
 * - sempre fora: a Inbox (ideias soltas do autor), as referências e as fases planejadas das fichas e as chaves do Codex ao vivo;
 * - sem `showSecrets`: fichas, relações, eventos e fatos secretos, e os trechos [segredo].
 */
export function readerCopy(universe: Universe, showSecrets: boolean): Universe {
  const sceneIds = new Set(universe.scenes.map((sc) => sc.id))
  const base: Universe = {
    ...universe,
    // As referências (o que inspirou cada ficha) e as fases planejadas (ainda sem cena) são só do autor.
    entities: universe.entities.map((e) => {
      const phases = e.phases?.filter((p) => p.sceneId && sceneIds.has(p.sceneId))
      return e.refs || phases?.length !== e.phases?.length ? { ...e, refs: undefined, phases: phases?.length ? phases : undefined } : e
    }),
    inbox: [],
    // Lixeira e histórico guardam versões antigas (inclusive o que era secreto).
    trash: [],
    history: [],
    groups: universe.groups.map((g) => ({ ...g, share: null })),
  }
  if (showSecrets) return base

  const hidden = new Set(universe.entities.filter((e) => e.canon === 'secreto').map((e) => e.id))
  const gone = (id: string | null) => id !== null && hidden.has(id)
  const facts = base.facts.filter((f) => f.canon !== 'secreto' && !gone(f.subjectId) && !gone(f.objectId) && !gone(f.speakerId))
  const factIds = new Set(facts.map((f) => f.id))

  return stripDeep({
    ...base,
    entities: base.entities.filter((e) => !hidden.has(e.id)).map((e) => (gone(e.parentId) ? { ...e, parentId: null } : e)),
    relations: base.relations
      .filter((r) => r.canon !== 'secreto' && !gone(r.fromId) && !gone(r.toId))
      .map((r) => ({ ...r, via: r.via.filter((v) => !gone(v.entityId)) })),
    events: base.events
      .filter((e) => e.canon !== 'secreto')
      .map((e) => ({ ...e, placeId: gone(e.placeId) ? null : e.placeId, entityIds: e.entityIds.filter((id) => !gone(id)) })),
    revelations: base.revelations.filter((r) => !gone(r.targetId)),
    sheets: base.sheets.map((s) => (gone(s.entityId) ? { ...s, entityId: null } : s)),
    maps: base.maps.map((m) => ({ ...m, pins: m.pins.filter((p) => !gone(p.entityId)) })),
    facts,
    knowledge: base.knowledge.filter((k) => factIds.has(k.factId) && !gone(k.holderId)),
    scenes: base.scenes.map((s) => ({
      ...s,
      povId: gone(s.povId) ? null : s.povId,
      placeId: gone(s.placeId) ? null : s.placeId,
      presentIds: s.presentIds.filter((id) => !gone(id)),
    })),
    seeds: base.seeds.map((s) => ({ ...s, entityIds: s.entityIds.filter((id) => !gone(id)) })),
  })
}

/** Uma cena sem os trechos [segredo] (para o livro que sai: EPUB, Word, PDF, Markdown). */
export function sceneWithoutSecrets<T extends { text: string; doc: unknown }>(scene: T): T {
  if (!hasSecretMark(scene.text)) return scene
  return { ...scene, text: stripSecrets(scene.text), doc: stripDeep(scene.doc) }
}
