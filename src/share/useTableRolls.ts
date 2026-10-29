import { useEffect, useRef } from 'react'
import { physicalRandom } from '../logic/dice'
import type { Universe } from '../model/schema'
import { newId, patch } from '../model/universe'
import { combatTargets } from '../rpg/combat'
import { aimAt, describeOutcome, resolveRoll, type RollOutcome } from '../rpg/rolls'
import { makeSystem } from '../rpg/systems'
import type { Prefs } from '../state/prefs'
import { forgetGroup, noteLeft, notePresence, PRESENCE_EVERY } from './presence'
import { joinTable, type TableRoll } from './server'
import { serverFrom } from './useCodexSync'

const FALLBACK = makeSystem('narrativo')

/** Uma rolagem que chegou do celular de um jogador, já conferida pelo Papirus do mestre. */
export interface IncomingRoll {
  groupId: string
  outcome: RollOutcome
  who: string
  logged: boolean
}

const listeners = new Set<(r: IncomingRoll) => void>()

/** A bandeja de rolagens da mesa escuta por aqui. */
export function onIncomingRoll(fn: (r: IncomingRoll) => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/**
 * Refaz a conta de uma rolagem do jogador com os dados que ele disse (ou que o celular sorteou),
 * pelas regras do sistema da mesa. Com um alvo na iniciativa, compara com a Defesa dele.
 */
export function readIncoming(universe: Universe, groupId: string, r: TableRoll): RollOutcome | null {
  const group = universe.groups.find((g) => g.id === groupId)
  const system = universe.systems.find((s) => s.id === group?.systemId)
  let o: RollOutcome
  try {
    o = { ...resolveRoll(system ?? FALLBACK, r.name, r.expression, r.target, physicalRandom(r.expression, r.faces), r.critFrom), physical: r.physical }
  } catch {
    return null
  }
  const session = universe.sessions.find((s) => s.groupId === groupId && s.status === 'em-andamento')
  const target = r.aim && session ? combatTargets(universe, session, system).find((t) => t.id === r.aim!.id) : undefined
  if (!target) return o
  return aimAt(o, r.kind === 'dano' ? { target, hurts: true } : { target })
}

/**
 * No Papirus do mestre: a mesa ao vivo de cada grupo com Codex compartilhado. Sabe quem
 * está com o Codex aberto e escuta as rolagens dos jogadores.
 * Cada uma vai para o registro da sessão e para a bandeja; num ataque com alvo, o mestre
 * confere contra a Defesa e devolve só o veredito (acerta ou erra) para a mesa.
 */
export function useTableRolls(universe: Universe, prefs: Prefs, update: (change: (u: Universe) => Universe) => void, enabled: boolean) {
  const latest = useRef({ universe, update })
  useEffect(() => {
    latest.current = { universe, update }
  })
  const server = serverFrom(prefs)
  const shared = enabled ? universe.groups.filter((g) => g.share).map((g) => [g.id, g.share!.id] as const) : []
  const key = JSON.stringify(shared)

  useEffect(() => {
    if (!server) return
    const groups = JSON.parse(key) as [string, string][]
    const seen = new Set<string>()
    const tables = groups.map(([groupId, codexId]) => {
      const t = joinTable(server, codexId, {
        roll: (r) => {
          if (seen.has(r.id)) return
          seen.add(r.id)
          const { universe: u, update: write } = latest.current
          const outcome = readIncoming(u, groupId, r)
          if (!outcome) return
          const group = u.groups.find((g) => g.id === groupId)
          const system = u.systems.find((s) => s.id === group?.systemId)
          const session = u.sessions.find((s) => s.groupId === groupId && s.status === 'em-andamento')
          const logged = Boolean(session && (system ? system.features.rollLog : true))
          if (logged) {
            const at = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
            const text = `${describeOutcome(outcome, r.who)} · pelo Codex`
            write((v) => {
              const s = v.sessions.find((x) => x.id === session!.id)
              return s ? patch(v, 'sessions', s.id, { log: [...s.log, { id: newId(), at, text, kind: 'rolagem' }] }) : v
            })
          }
          if (outcome.combat && !outcome.combat.hurts && outcome.verdict) void t.sendCheck({ id: r.id, verdict: outcome.verdict, tone: outcome.tone }).catch(() => undefined)
          for (const l of listeners) l({ groupId, outcome, who: r.who, logged })
        },
        // Quem está na mesa: cada celular avisa; quem chega pergunta, e o mestre responde também.
        presence: (p) => notePresence(groupId, p),
        left: (id) => noteLeft(groupId, id),
        ask: () => void t.sendPresence(me).catch(() => undefined),
      })
      const me = { id: `mestre-${newId()}`, role: 'mestre' as const, who: null }
      void t.ask().catch(() => undefined)
      void t.sendPresence(me).catch(() => undefined)
      const beat = setInterval(() => void t.sendPresence(me).catch(() => undefined), PRESENCE_EVERY)
      return { t, me, beat, groupId }
    })
    return () =>
      tables.forEach(({ t, me, beat, groupId }) => {
        clearInterval(beat)
        void t.sendLeft(me.id).catch(() => undefined)
        forgetGroup(groupId)
        t.leave()
      })
  }, [server, key])
}
