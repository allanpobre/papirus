import type { Session, Universe } from '../model/schema'
import { byId, draftInbox, draftSession, insert, newId, patch } from '../model/universe'

/** As linhas que o próprio Papirus escreve no registro quando a sessão começa e termina. */
export const START_NOTE = 'A sessão começou.'
export const END_NOTE = 'A sessão terminou.'

const clock = (now: Date) => now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

/** O que aconteceu de fato na sessão: tudo, menos as linhas de começo e fim. */
export const playedLog = (s: Session) => s.log.filter((l) => l.text !== START_NOTE && l.text !== END_NOTE)

/** A sessão que "Começar" vai abrir: a primeira planejada da mesa, ou uma nova depois da última. */
export function sessionToStart(u: Universe, groupId: string): { id: string | null; number: number; title: string } {
  const sessions = u.sessions.filter((s) => s.groupId === groupId).sort((a, b) => a.number - b.number)
  const planned = sessions.find((s) => s.status === 'planejada')
  if (planned) return { id: planned.id, number: planned.number, title: planned.title }
  const number = (sessions.at(-1)?.number ?? 0) + 1
  return { id: null, number, title: `Sessão ${number}` }
}

/**
 * Começa a sessão (ou cria a próxima, sem `id`): fica em andamento, guarda a hora do começo
 * e abre o registro com "A sessão começou". Devolve o universo e a sessão que começou.
 */
export function beginSession(u: Universe, groupId: string, id: string | null, now = new Date()): [Universe, string] {
  let next = u
  let sessionId = id
  if (!sessionId) {
    const [withNew, s] = insert(next, 'sessions', draftSession(sessionToStart(u, groupId).number, groupId))
    next = withNew
    sessionId = s.id
  }
  const s = byId(next, 'sessions', sessionId)
  if (!s) return [u, sessionId]
  const first = s.startedAt === null
  next = patch(next, 'sessions', s.id, {
    status: 'em-andamento',
    startedAt: s.startedAt ?? now.toISOString(),
    log: first ? [...s.log, { id: newId(), at: clock(now), text: START_NOTE, kind: 'nota' }] : s.log,
  })
  return [next, s.id]
}

/**
 * Encerra a sessão: fecha o registro com "A sessão terminou" e, se algo aconteceu,
 * manda o registro inteiro para Ideias, para o mestre revisar com calma.
 */
export function finishSession(u: Universe, id: string, groupName: string, now = new Date()): { universe: Universe; sent: boolean } {
  const s = byId(u, 'sessions', id)
  if (!s) return { universe: u, sent: false }
  const log = s.startedAt ? [...s.log, { id: newId(), at: clock(now), text: END_NOTE, kind: 'nota' as const }] : s.log
  let next = patch(u, 'sessions', s.id, { status: 'encerrada', log })
  const sent = playedLog(s).length > 0
  if (sent) {
    const transcript = [`${s.title} — ${groupName}`, '', ...log.map((l) => `[${l.at}] ${l.text}`)].join('\n')
    next = insert(next, 'inbox', draftInbox(transcript, 'sessao', s.title))[0]
  }
  return { universe: next, sent }
}

/** O resumo do fim: quanto durou, quantas rolagens, notas e revelações. */
export function sessionSummary(u: Universe, s: Session, now = Date.now()) {
  const played = playedLog(s)
  return {
    minutes: s.startedAt ? Math.max(0, Math.round((now - Date.parse(s.startedAt)) / 60_000)) : null,
    rolls: played.filter((l) => l.kind === 'rolagem').length,
    notes: played.filter((l) => l.kind === 'nota' && !/^Rodada \d+$/.test(l.text)).length,
    revelations: u.revelations.filter((r) => r.sessionId === s.id).length,
  }
}

/** O nome próprio da sessão, sem o "Sessão 2 — " do começo (o número já aparece ao lado); null se ela não tem um. */
export function sessionName(number: number, title: string): string | null {
  const rest = title.replace(new RegExp(`^\\s*Sessão\\s+${number}(?!\\d)\\s*(?:[—–:·-]\\s*)?`, 'i'), '').trim()
  return rest || null
}

/** "2 h 15 min", "40 min", "< 1 min". */
export function durationLabel(minutes: number): string {
  if (minutes < 1) return '< 1 min'
  if (minutes < 60) return `${minutes} min`
  const m = minutes % 60
  return m ? `${Math.floor(minutes / 60)} h ${m} min` : `${minutes / 60} h`
}
