import type { GameSystem, Session, Sheet, Universe } from '../model/schema'
import { byId, newId, patch } from '../model/universe'
import { describeOutcome, resolveRoll, rollAttribute, rollSkill, type RollOutcome, type RollRules } from './rolls'
import { attendanceOf, partyOf } from './sessionLife'

export type RollRequest = Session['requests'][number]
export type RequestResult = RollRequest['results'][number]

const clock = (now: Date) => now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

/** "Percepção", "Percepção · CD 15", "Força · 2 sucessos". */
export function requestLabel(r: Pick<RollRequest, 'name' | 'dc' | 'expression' | 'kind'>, rules?: RollRules): string {
  const what = r.kind === 'livre' && r.expression ? `${r.name} (${r.expression})` : r.name
  if (r.dc === null) return what
  return rules?.resolution === 'sucessos' ? `${what} · ${r.dc} ${r.dc === 1 ? 'sucesso' : 'sucessos'}` : `${what} · CD ${r.dc}`
}

/** Quem deve rolar: os escolhidos, ou todos que estão nesta sessão (quem o mestre conduz também; quem ficou de fora, não). */
export function requestTargets(u: Universe, s: Session, r: RollRequest): Sheet[] {
  const party = partyOf(u, s.groupId).filter((p) => attendanceOf(s, p.id) !== 'fora')
  return r.sheetIds.length ? party.filter((p) => r.sheetIds.includes(p.id)) : party
}

/**
 * Passou ou não, pela dificuldade (que só o mestre vê). Sem dificuldade, o mestre decide olhando o total.
 * Nos sistemas "abaixo de", o próprio valor da ficha já diz.
 */
export function judge(rules: RollRules, o: RollOutcome, dc: number | null): { pass: boolean | null; verdict: string | null } {
  if (rules.resolution === 'abaixo') return { pass: o.tone === 'sucesso' || o.tone === 'critico', verdict: o.verdict }
  if (rules.resolution === 'sucessos') {
    const hits = o.result.parts.flatMap((p) => p.kept).filter((d) => d >= rules.successTarget).length
    const need = dc ?? 1
    return { pass: hits >= need, verdict: o.verdict }
  }
  if (dc === null) return { pass: null, verdict: o.verdict }
  const pass = o.result.total >= dc
  return { pass, verdict: pass ? 'Passou' : 'Falhou' }
}

/** O mestre pede um teste. Fica na sessão (os celulares mostram) e no registro. */
export function askRoll(
  u: Universe,
  sessionId: string,
  ask: { kind: RollRequest['kind']; name: string; expression?: string; dc: number | null; sheetIds: string[] },
  now = new Date(),
): [Universe, RollRequest | null] {
  const s = byId(u, 'sessions', sessionId)
  const name = ask.name.trim()
  if (!s || !name) return [u, null]
  const req: RollRequest = { id: newId(), at: now.toISOString(), kind: ask.kind, name, expression: ask.expression?.trim() ?? '', dc: ask.dc, sheetIds: ask.sheetIds, results: [], open: true }
  const group = s.groupId ? byId(u, 'groups', s.groupId) : undefined
  const system = u.systems.find((x) => x.id === group?.systemId)
  const who = ask.sheetIds.length ? ask.sheetIds.map((id) => byId(u, 'sheets', id)?.name).filter(Boolean).join(', ') : 'todos'
  return [
    patch(u, 'sessions', s.id, {
      requests: [...s.requests, req].slice(-20),
      log: [...s.log, { id: newId(), at: clock(now), text: `Teste pedido: ${requestLabel(req, system)} — ${who}`, kind: 'nota' }],
    }),
    req,
  ]
}

/** Guarda o que alguém tirou no teste pedido (vale o último), e põe no registro. */
export function recordResult(u: Universe, sessionId: string, requestId: string, sheet: Sheet, o: RollOutcome, by: RequestResult['by'], rules: RollRules, now = new Date()): Universe {
  const s = byId(u, 'sessions', sessionId)
  const req = s?.requests.find((r) => r.id === requestId)
  if (!s || !req) return u
  const { pass, verdict } = judge(rules, o, req.dc)
  const result: RequestResult = { sheetId: sheet.id, total: o.result.total, verdict, pass, by, at: now.toISOString() }
  const line = `${describeOutcome(o, sheet.name)}${pass === true ? ' · passou' : pass === false ? ' · falhou' : ''}${by === 'jogador' ? ' · pelo Codex' : ''}`
  return patch(u, 'sessions', s.id, {
    requests: s.requests.map((r) => (r.id === requestId ? { ...r, results: [...r.results.filter((x) => x.sheetId !== sheet.id), result] } : r)),
    log: [...s.log, { id: newId(), at: clock(now), text: line, kind: 'rolagem' }],
  })
}

/** O mestre rola por alguém (quem ele conduz, ou quem está sem o celular), pela ficha. */
export function rollFor(system: GameSystem | undefined, sheet: Sheet, req: RollRequest, random?: () => number): RollOutcome | null {
  try {
    if (req.kind === 'livre' || !system) return resolveRoll(system ?? { resolution: 'total', successTarget: 6 }, req.name, req.expression || '1d20', undefined, random)
    const list = req.kind === 'pericia' ? system.skills : system.attributes
    const item = list.find((x) => x.name === req.name)
    if (!item) return null
    return req.kind === 'pericia' ? rollSkill(system, sheet, item.id, random) : rollAttribute(system, sheet, item.id, random)
  } catch {
    return null
  }
}

export const closeRequest = (u: Universe, sessionId: string, requestId: string): Universe => {
  const s = byId(u, 'sessions', sessionId)
  return s ? patch(u, 'sessions', s.id, { requests: s.requests.map((r) => (r.id === requestId ? { ...r, open: false } : r)) }) : u
}

/** Os pedidos ainda abertos da sessão. */
export const openRequests = (s: Session | undefined): RollRequest[] => (s?.requests ?? []).filter((r) => r.open)
