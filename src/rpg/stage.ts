import type { Group, Session, Universe } from '../model/schema'
import { byId, newId, patch } from '../model/universe'

/*
 * O palco da sessão: as cenas do roteiro (a atual aparece no celular de cada jogador) e os
 * relógios de progresso da mesa ("A guarda chega", 2 de 4).
 */

type Beat = Session['beats'][number]
export type Clock = Group['clocks'][number]

const clock = (now: Date) => now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

/** Uma linha no registro, se a sessão estiver em andamento. */
function note(u: Universe, s: Session, text: string, now: Date): Universe {
  if (s.status !== 'em-andamento') return u
  return patch(u, 'sessions', s.id, { log: [...byId(u, 'sessions', s.id)!.log, { id: newId(), at: clock(now), text, kind: 'nota' }] })
}

/** A cena que está acontecendo agora. */
export const currentBeat = (s: Session | undefined): Beat | undefined => (s?.beatId ? s.beats.find((b) => b.id === s.beatId) : undefined)

export function addBeat(u: Universe, sessionId: string, title: string, mood = ''): Universe {
  const s = byId(u, 'sessions', sessionId)
  const clean = title.trim()
  if (!s || !clean) return u
  return patch(u, 'sessions', s.id, { beats: [...s.beats, { id: newId(), title: clean.slice(0, 120), mood: mood.trim().slice(0, 160), done: false }] })
}

export function editBeat(u: Universe, sessionId: string, beatId: string, change: Partial<Pick<Beat, 'title' | 'mood'>>): Universe {
  const s = byId(u, 'sessions', sessionId)
  if (!s) return u
  return patch(u, 'sessions', s.id, { beats: s.beats.map((b) => (b.id === beatId ? { ...b, ...change } : b)) })
}

export function removeBeat(u: Universe, sessionId: string, beatId: string): Universe {
  const s = byId(u, 'sessions', sessionId)
  if (!s) return u
  return patch(u, 'sessions', s.id, { beats: s.beats.filter((b) => b.id !== beatId), beatId: s.beatId === beatId ? null : s.beatId })
}

/** Esta cena começa agora: a de antes conta como jogada, e o registro marca a troca. */
export function playBeat(u: Universe, sessionId: string, beatId: string, now = new Date()): Universe {
  const s = byId(u, 'sessions', sessionId)
  const beat = s?.beats.find((b) => b.id === beatId)
  if (!s || !beat || s.beatId === beatId) return u
  const next = patch(u, 'sessions', s.id, { beatId, beats: s.beats.map((b) => (b.id === s.beatId ? { ...b, done: true } : b.id === beatId ? { ...b, done: false } : b)) })
  return note(next, s, `Cena: ${beat.title}`, now)
}

/**
 * Riscar (ou desriscar) uma cena. Riscar a cena atual passa para a próxima ainda não jogada,
 * como virar a página do roteiro.
 */
export function toggleBeat(u: Universe, sessionId: string, beatId: string, now = new Date()): Universe {
  const s = byId(u, 'sessions', sessionId)
  const beat = s?.beats.find((b) => b.id === beatId)
  if (!s || !beat) return u
  const beats = s.beats.map((b) => (b.id === beatId ? { ...b, done: !b.done } : b))
  if (beat.done || s.beatId !== beatId) return patch(u, 'sessions', s.id, { beats })
  const after = beats.slice(beats.findIndex((b) => b.id === beatId) + 1).find((b) => !b.done) ?? beats.find((b) => !b.done)
  const next = patch(u, 'sessions', s.id, { beats, beatId: after?.id ?? null })
  return after ? note(next, s, `Cena: ${after.title}`, now) : next
}

// ─── Relógios ─────────────────────────────────────────────────────────

/** Os tamanhos de relógio de costume. */
export const CLOCK_SIZES = [4, 6, 8] as const

export function addClock(u: Universe, groupId: string, name: string, size = 4, hidden = false): Universe {
  const g = byId(u, 'groups', groupId)
  const clean = name.trim()
  if (!g || !clean) return u
  return patch(u, 'groups', g.id, { clocks: [...g.clocks, { id: newId(), name: clean.slice(0, 80), size: Math.max(2, Math.min(12, Math.trunc(size))), filled: 0, hidden }] })
}

/** Enche (ou esvazia) um pedaço. Quando enche de vez, o registro da sessão conta. */
export function tickClock(u: Universe, groupId: string, clockId: string, delta: 1 | -1, now = new Date()): Universe {
  const g = byId(u, 'groups', groupId)
  const c = g?.clocks.find((x) => x.id === clockId)
  if (!g || !c) return u
  const filled = Math.max(0, Math.min(c.size, c.filled + delta))
  if (filled === c.filled) return u
  const next = patch(u, 'groups', g.id, { clocks: g.clocks.map((x) => (x.id === clockId ? { ...x, filled } : x)) })
  const live = u.sessions.find((s) => s.groupId === g.id && s.status === 'em-andamento')
  return live ? note(next, live, filled === c.size ? `Relógio cheio: ${c.name}!` : `Relógio ${c.name}: ${filled} de ${c.size}`, now) : next
}

export function editClock(u: Universe, groupId: string, clockId: string, change: Partial<Pick<Clock, 'name' | 'hidden' | 'size'>>): Universe {
  const g = byId(u, 'groups', groupId)
  if (!g) return u
  return patch(u, 'groups', g.id, { clocks: g.clocks.map((c) => (c.id === clockId ? { ...c, ...change, filled: Math.min(change.size ?? c.size, c.filled) } : c)) })
}

export function removeClock(u: Universe, groupId: string, clockId: string): Universe {
  const g = byId(u, 'groups', groupId)
  return g ? patch(u, 'groups', g.id, { clocks: g.clocks.filter((c) => c.id !== clockId) }) : u
}

/** Os relógios que os jogadores veem (os escondidos ficam só com o mestre). */
export const sharedClocks = (g: Group | undefined): Clock[] => (g?.clocks ?? []).filter((c) => !c.hidden)
