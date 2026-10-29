import { unmarkReveals } from '../logic/reveals'
import { codexFor, factSentence, playerTag } from '../logic/codex'
import { stripSecrets } from '../logic/secrets'
import { formatYear, kindPlural } from '../model/labels'
import type { GameSystem, Sheet, Universe } from '../model/schema'
import { byId, entityName } from '../model/universe'
import { mesaTheme } from '../rpg/themes'
import { initiativeOrder, isDown } from '../rpg/combat'
import { attendanceOf, recentNotices } from '../rpg/sessionLife'
import { openRequests, requestTargets } from '../rpg/requests'
import { attributeExpression, bonusLabel, damageExpression, skillExpression, type RollRules } from '../rpg/rolls'
import { costResource, critFrom, critMult, isPool } from '../rpg/sheets'

/**
 * O Codex de uma mesa como os jogadores o veem, em dados simples e já filtrados:
 * só o que foi revelado, sem trechos secretos, sem rótulo de mentira. É isto que
 * vai para o servidor; nada do universo além disto sai do computador do mestre.
 */
export interface CodexSnapshot {
  v: 1
  universe: string
  group: string
  at: string
  party: {
    name: string
    player: string
    fields: [string, string][]
    attrs: [string, number][]
    /** A ficha toda, só para consulta (retratos antigos não têm). */
    image?: string
    pools?: [string, number, number][]
    values?: [string, number][]
    conditions?: string[]
    skills?: [string, string][]
    attacks?: { name: string; test: string; damage: string; critical: string }[]
    abilities?: { name: string; cost: string; text: string }[]
    inventory?: [string, number][]
    /** O que o jogador pode rolar pelo Codex, já com os números da ficha. */
    rolls?: CodexRoll[]
    /** Nesta sessão, o mestre conduz o personagem ou ele fica de fora (o jogador não veio). */
    away?: 'mestre' | 'fora'
  }[]
  sections: { title: string; entries: { name: string; summary: string; description: string; depth: 'nome' | 'resumo' | 'completo'; fresh?: boolean; image?: string }[] }[]
  events: { when: string; title: string; year?: number; fresh?: boolean }[]
  /** Ligações reveladas, pelo nome (opcional: retratos antigos não têm). */
  relations?: { from: string; to: string; text: string; fresh?: boolean }[]
  facts: { text: string; tag: string }[]
  clues: { text: string; mystery: string }[]
  maps: { name: string; image: string; width: number; height: number; pins: { x: number; y: number; label: string }[] }[]
  /** Tema da mesa (cores por gênero) escolhido pelo mestre; os jogadores só escolhem claro ou escuro. */
  theme?: string | null
  /** Como ler as rolagens feitas pelo Codex (sem sistema, não há rolagens). */
  rules?: RollRules
  /** A sessão em andamento: os jogadores veem quando ela começa e quando termina. */
  session?: { number: number; title: string; startedAt: string | null } | null
  /** Os testes que o mestre pediu e ainda estão abertos (sem a dificuldade): para quem, e quem já rolou. */
  requests?: { id: string; kind: 'pericia' | 'atributo' | 'livre'; name: string; expression: string; who: string[]; done: string[] }[]
  /** O diário da campanha: os resumos que o mestre publicou, sessão por sessão. */
  journal?: { number: number; title: string; when: string; text: string }[]
  /** Os últimos avisos do mestre na sessão em andamento ("Um inimigo aparece!"). */
  notices?: { id: string; at: string; text: string; tone: 'aviso' | 'perigo' | 'misterio' }[]
  /** Combate em andamento: a ordem e de quem é a vez. A vida e a Defesa dos inimigos não vêm. */
  combat?: { round: number; order: { id: string; name: string; pc: boolean; current: boolean; down: boolean }[] } | null
}

/** Uma rolagem da ficha, pronta para o Codex. */
export interface CodexRoll {
  kind: 'atributo' | 'pericia' | 'ataque'
  name: string
  expression: string
  /** Perícia treinada (aparece primeiro). */
  trained?: boolean
  /** Sistemas "abaixo de": o valor a não passar. */
  target?: number
  critFrom?: number
  /** Ataques: o dano, já com os números, e o multiplicador do crítico. */
  damage?: string
  mult?: number
}

function rollsOf(system: GameSystem, s: Sheet): CodexRoll[] {
  const below = system.resolution === 'abaixo'
  const signed = (n: number) => (n >= 0 ? `+${n}` : String(n))
  return [
    ...(s.attacks ?? []).map((a): CodexRoll => ({
      kind: 'ataque',
      name: a.name || 'Ataque',
      expression: system.resolution === 'total' ? `1d20${signed(a.bonus)}` : '',
      ...(critFrom(a.critical) < 20 ? { critFrom: critFrom(a.critical) } : {}),
      damage: damageExpression(system, s, a.damage),
      mult: critMult(a.critical),
    })),
    ...system.attributes.map((a): CodexRoll => ({
      kind: 'atributo',
      name: a.name,
      expression: attributeExpression(system, s, a.id),
      ...(below ? { target: s.attributes[a.id] ?? a.default } : {}),
    })),
    ...system.skills.map((k): CodexRoll => ({
      kind: 'pericia',
      name: k.name,
      expression: skillExpression(system, s, k.id),
      ...((s.skills[k.id] ?? 0) !== 0 ? { trained: true } : {}),
      ...(below ? { target: s.skills[k.id] ?? 0 } : {}),
    })),
  ]
}

function liveSession(universe: Universe, groupId: string): CodexSnapshot['session'] {
  const s = universe.sessions.find((x) => x.groupId === groupId && x.status === 'em-andamento')
  return s ? { number: s.number, title: s.title, startedAt: s.startedAt } : null
}

/** O combate da sessão em andamento da mesa, como os jogadores podem ver. */
function combatOf(universe: Universe, groupId: string): CodexSnapshot['combat'] {
  const session = universe.sessions.find((x) => x.groupId === groupId && x.status === 'em-andamento')
  if (!session?.initiative.length) return null
  const order = initiativeOrder(session)
  const turn = session.turn % order.length
  return {
    round: session.round,
    order: order.map((e, i) => {
      const sheet = e.sheetId ? byId(universe, 'sheets', e.sheetId) : undefined
      return { id: e.id, name: e.name, pc: sheet?.role === 'pj', current: i === turn, down: isDown(universe, e) }
    }),
  }
}

export function codexSnapshot(universe: Universe, groupId: string, untilSession?: number): CodexSnapshot {
  const codex = codexFor(universe, groupId, untilSession)
  const group = byId(universe, 'groups', groupId)
  const system = group?.systemId ? universe.systems.find((x) => x.id === group.systemId) : undefined
  const suffix = universe.settings.calendarSuffix
  const kinds = [...new Set(codex.entries.map((e) => e.entity.kind))]
  // A sessão em andamento: quem joga e os avisos do mestre (o Codex "até a sessão N" não tem).
  const live = untilSession === undefined ? universe.sessions.find((x) => x.groupId === groupId && x.status === 'em-andamento') : undefined

  return {
    v: 1,
    universe: universe.name,
    group: group?.name ?? '',
    theme: mesaTheme(group?.theme, system?.name),
    ...(system ? { rules: { resolution: system.resolution, successTarget: system.successTarget } } : {}),
    session: liveSession(universe, groupId),
    notices: recentNotices(live),
    requests: live
      ? openRequests(live).map((r) => ({
          id: r.id,
          kind: r.kind,
          name: r.name,
          expression: r.expression,
          who: r.sheetIds.length ? requestTargets(universe, live, r).map((p) => p.name) : [],
          done: r.results.map((x) => byId(universe, 'sheets', x.sheetId)?.name ?? '').filter(Boolean),
        }))
      : [],
    journal: universe.sessions
      .filter((s) => s.groupId === groupId && s.recapShared && s.recap.trim() && (untilSession === undefined || s.number <= untilSession))
      .sort((a, b) => a.number - b.number)
      .map((s) => ({ number: s.number, title: s.title, when: s.playedOn, text: s.recap.trim() })),
    combat: combatOf(universe, groupId),
    at: new Date().toISOString(),
    party: codex.sheets.map((s) => {
      const system = universe.systems.find((x) => x.id === s.systemId)
      const res = (id: string, def: number) => s.resources[id] ?? { current: def, max: def }
      const cost = costResource(system)
      const signed = (n: number) => (n >= 0 ? `+${n}` : String(n))
      const portrait = s.image ?? (s.entityId ? byId(universe, 'entities', s.entityId)?.image : null)
      const away = attendanceOf(live, s.id)
      return {
        name: s.name,
        player: s.player,
        ...(away !== 'joga' ? { away } : {}),
        fields: Object.entries(s.fields).filter(([, v]) => v.trim()),
        attrs: (system?.attributes ?? []).map((a) => [a.abbr, s.attributes[a.id] ?? a.default] as [string, number]),
        ...(portrait ? { image: portrait } : {}),
        pools: (system?.resources ?? []).filter(isPool).map((r) => [r.abbr, res(r.id, r.default).current, res(r.id, r.default).max] as [string, number, number]),
        values: (system?.resources ?? []).filter((r) => !isPool(r)).map((r) => [r.abbr, res(r.id, r.default).current] as [string, number]),
        conditions: s.conditions,
        skills: system ? system.skills.filter((k) => (s.skills[k.id] ?? 0) !== 0).map((k) => [k.name, bonusLabel(skillExpression(system, s, k.id))] as [string, string]) : [],
        attacks: (s.attacks ?? []).map((a) => ({ name: a.name, test: system?.resolution === 'total' ? signed(a.bonus) : '', damage: damageExpression(system, s, a.damage), critical: a.critical })),
        abilities: (s.abilities ?? []).map((a) => ({ name: a.name, cost: a.cost > 0 && cost ? `${a.cost} ${cost.abbr}` : '', text: a.text })),
        inventory: (s.inventory ?? []).map((i) => [i.name, i.qty] as [string, number]),
        ...(system ? { rolls: rollsOf(system, s) } : {}),
      }
    }),
    sections: kinds.map((k) => ({
      title: kindPlural(k),
      entries: codex.entries
        .filter((e) => e.entity.kind === k)
        .map(({ entity, depth }) => ({
          name: entity.name,
          depth,
          fresh: codex.fresh.has(entity.id),
          summary: depth === 'nome' ? '' : unmarkReveals(stripSecrets(entity.summary)),
          description: depth === 'completo' ? unmarkReveals(stripSecrets(entity.description)) : '',
          // O retrato aparece quando a mesa já sabe mais que o nome.
          ...(depth !== 'nome' && entity.image ? { image: entity.image } : {}),
        })),
    })),
    events: codex.events.map((e) => ({
      when: e.endYear !== null ? `${formatYear(e.year, suffix)} – ${formatYear(e.endYear, suffix)}` : formatYear(e.year, suffix),
      title: e.title,
      year: e.year,
      fresh: codex.fresh.has(e.id),
    })),
    relations: codex.relations.map((r) => {
      // Quem está por trás só aparece se a mesa já conhece essa ficha.
      const known = new Set(codex.entries.map((e) => e.entity.id))
      const via = r.via.filter((v) => known.has(v.entityId)).map((v) => `${v.role || 'com'} ${entityName(universe, v.entityId)}`)
      const from = entityName(universe, r.fromId)
      const to = entityName(universe, r.toId)
      return { from, to, text: `${from} ${r.type} ${to}${via.length ? `, ${via.join(', ')}` : ''}`, fresh: codex.fresh.has(r.id) }
    }),
    facts: codex.facts.map((f) => ({ text: factSentence(universe, f), tag: playerTag(universe, f) })),
    clues: codex.clues.map(({ seed, clue }) => ({ text: clue.text, mystery: seed.kind === 'misterio' ? seed.title : '' })),
    maps: codex.maps.map(({ map, pins }) => ({
      name: map.name,
      image: map.image,
      width: map.width,
      height: map.height,
      pins: pins.map((p) => ({ x: p.x, y: p.y, label: p.label || entityName(universe, p.entityId) })),
    })),
  }
}

export const isEmptySnapshot = (s: CodexSnapshot) =>
  !s.party.length && !s.sections.length && !s.events.length && !s.facts.length && !s.clues.length && !s.maps.length && !(s.relations ?? []).length && !(s.journal ?? []).length

/** Mudou algo revelado (não só a vida do grupo ou a vez no combate): vale o aviso de novidades. */
export const sameReveals = (a: CodexSnapshot, b: CodexSnapshot) => {
  const pick = (c: CodexSnapshot) => JSON.stringify([c.sections, c.events, c.relations ?? [], c.facts, c.clues, c.maps.map((m) => [m.name, m.pins]), c.party.map((p) => p.name)])
  return pick(a) === pick(b)
}

const DEPTH_RANK = { nome: 0, resumo: 1, completo: 2 } as const

/** O que a mesa ficou sabendo de um retrato para o outro, em textos curtos ("Homem Pálido", "mais sobre Rhea"). */
export function revealedSince(a: CodexSnapshot, b: CodexSnapshot): string[] {
  const depth = new Map(a.sections.flatMap((s) => s.entries.map((e) => [e.name, e.depth] as const)))
  const out: string[] = []
  for (const e of b.sections.flatMap((s) => s.entries)) {
    const was = depth.get(e.name)
    if (!was) out.push(e.name)
    else if (DEPTH_RANK[e.depth] > DEPTH_RANK[was]) out.push(`mais sobre ${e.name}`)
  }
  const newOnes = <T>(before: T[], after: T[], key: (x: T) => string) => {
    const had = new Set(before.map(key))
    return after.filter((x) => !had.has(key(x)))
  }
  out.push(...newOnes(a.facts, b.facts, (f) => f.text).map((f) => f.text))
  out.push(...newOnes(a.events, b.events, (e) => e.title).map((e) => e.title))
  out.push(...newOnes(a.relations ?? [], b.relations ?? [], (r) => r.text).map((r) => r.text))
  out.push(...newOnes(a.clues, b.clues, (c) => c.text).map((c) => (c.mystery ? `uma pista: ${c.mystery}` : 'uma pista')))
  out.push(...newOnes(a.maps, b.maps, (m) => m.name).map((m) => `o mapa ${m.name}`))
  out.push(...newOnes(a.journal ?? [], b.journal ?? [], (j) => String(j.number)).map((j) => `o diário da Sessão ${j.number}`))
  return out
}

/** Compara dois retratos ignorando a hora, para saber se vale publicar de novo. */
export const sameContent = (a: CodexSnapshot, b: CodexSnapshot) => JSON.stringify({ ...a, at: '' }) === JSON.stringify({ ...b, at: '' })
