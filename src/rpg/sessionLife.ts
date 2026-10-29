import { NOTICE_TONES, SESSION_ATTENDANCE, type Session, type Sheet, type Universe } from '../model/schema'
import { byId, draftInbox, draftRevelation, draftSession, insert, newId, patch } from '../model/universe'
import { roll } from '../logic/dice'
import { rollInitiative } from './rolls'

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
    const who = rollCall(u, s)
    const transcript = [`${s.title} — ${groupName}`, ...(who ? [who] : []), '', ...log.map((l) => `[${l.at}] ${l.text}`)].join('\n')
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

// ─── Quem joga nesta sessão ────────────────────────────────────────────

export type Attendance = (typeof SESSION_ATTENDANCE)[number]

export const ATTENDANCE_LABEL: Record<Attendance, string> = { joga: 'Joga', mestre: 'Mestre conduz', fora: 'Fica de fora' }

/** Os personagens de jogador da mesa. */
export const partyOf = (u: Universe, groupId: string | null) => u.sheets.filter((s) => s.groupId === groupId && s.role === 'pj')

/** Como o personagem está nesta sessão (sem nada marcado, joga). */
export const attendanceOf = (s: Session | undefined, sheetId: string): Attendance => s?.attendance?.[sheetId] ?? 'joga'

/**
 * Muda quem joga. Com a sessão em andamento, fica no registro: "Taren fica de fora desta sessão (Bruno não veio)".
 */
export function setAttendance(u: Universe, sessionId: string, sheetId: string, value: Attendance, now = new Date()): Universe {
  const s = byId(u, 'sessions', sessionId)
  const sheet = byId(u, 'sheets', sheetId)
  if (!s || !sheet || attendanceOf(s, sheetId) === value) return u
  const attendance = { ...s.attendance }
  if (value === 'joga') delete attendance[sheetId]
  else attendance[sheetId] = value
  const absent = sheet.player ? ` (${sheet.player} não veio)` : ''
  const line =
    value === 'fora' ? `${sheet.name} fica de fora desta sessão${absent}.` : value === 'mestre' ? `O mestre conduz ${sheet.name} nesta sessão${absent}.` : `${sheet.name} volta a jogar${sheet.player ? ` com ${sheet.player}` : ''}.`
  const log = s.status === 'em-andamento' ? [...s.log, { id: newId(), at: clock(now), text: line, kind: 'nota' as const }] : s.log
  return patch(u, 'sessions', s.id, { attendance, log })
}

/** A chamada da sessão, numa linha: quem jogou, quem o mestre conduziu e quem ficou de fora. */
export function rollCall(u: Universe, s: Session): string {
  const party = partyOf(u, s.groupId)
  if (!party.length) return ''
  const name = (p: Sheet) => (p.player ? `${p.name} (${p.player})` : p.name)
  const by = (a: Attendance) => party.filter((p) => attendanceOf(s, p.id) === a).map(name)
  return [
    by('joga').length ? `Na mesa: ${by('joga').join(', ')}` : '',
    by('mestre').length ? `O mestre conduziu: ${by('mestre').join(', ')}` : '',
    by('fora').length ? `De fora: ${by('fora').join(', ')}` : '',
  ]
    .filter(Boolean)
    .join(' · ')
}

// ─── Avisos do mestre ─────────────────────────────────────────────────

export type NoticeTone = (typeof NOTICE_TONES)[number]
export type Notice = Session['notices'][number]

export const NOTICE_TONE_LABEL: Record<NoticeTone, string> = { aviso: 'Aviso', perigo: 'Perigo', misterio: 'Mistério' }

/** Atalhos para improvisar: um toque e o aviso está pronto. */
export const NOTICE_PRESETS: { text: string; tone: NoticeTone }[] = [
  { text: 'Um inimigo aparece!', tone: 'perigo' },
  { text: 'Emboscada!', tone: 'perigo' },
  { text: 'Rolem iniciativa!', tone: 'perigo' },
  { text: 'Algo se aproxima…', tone: 'misterio' },
  { text: 'Vocês ouvem um barulho lá fora.', tone: 'misterio' },
  { text: 'Uma sombra passa pela janela.', tone: 'misterio' },
  { text: 'Pausa de 10 minutos.', tone: 'aviso' },
  { text: 'Última cena antes do intervalo.', tone: 'aviso' },
]

/** Quem aparece com o aviso: o nome no Codex (só o nome) e, se for briga, na iniciativa. */
export interface Appearance {
  entityId: string
  reveal: boolean
  fight: boolean
}

/**
 * Anuncia para a mesa: o aviso fica na sessão (os celulares mostram na tela inteira) e no registro.
 * Com alguém aparecendo, revela o nome no Codex e põe na iniciativa, se pedido.
 */
export function announce(u: Universe, sessionId: string, text: string, tone: NoticeTone, appear: Appearance | null = null, now = new Date()): [Universe, Notice | null] {
  const s = byId(u, 'sessions', sessionId)
  const clean = text.trim().slice(0, 160)
  if (!s || !clean) return [u, null]
  const notice: Notice = { id: newId(), at: now.toISOString(), text: clean, tone }
  let next = patch(u, 'sessions', s.id, {
    notices: [...s.notices, notice].slice(-20),
    log: [...s.log, { id: newId(), at: clock(now), text: `Aviso à mesa: ${clean}`, kind: 'nota' }],
  })
  const entity = appear ? byId(next, 'entities', appear.entityId) : undefined
  if (appear && entity && s.groupId) {
    const known = next.revelations.some((r) => r.groupId === s.groupId && r.target === 'entidade' && r.targetId === entity.id)
    if (appear.reveal && !known) next = insert(next, 'revelations', { ...draftRevelation(s.groupId, 'entidade', entity.id, s.id), depth: 'nome' })[0]
    const current = byId(next, 'sessions', s.id)!
    if (appear.fight && !current.initiative.some((i) => i.name === entity.name)) {
      const group = byId(next, 'groups', s.groupId)
      const system = next.systems.find((x) => x.id === group?.systemId)
      const sheet = next.sheets.find((x) => x.entityId === entity.id && x.groupId === s.groupId) ?? null
      const value = system ? rollInitiative(system, sheet) : roll('d20').total
      next = patch(next, 'sessions', s.id, {
        initiative: [...current.initiative, { id: newId(), name: entity.name, value, hp: '', note: '', sheetId: sheet?.id ?? null, defense: null, attacks: [], monsterId: null, conditions: [] }],
      })
    }
  }
  return [next, notice]
}

/** Os avisos que os celulares ainda mostram: os três últimos da sessão em andamento. */
export const recentNotices = (s: Session | undefined): Notice[] => (s?.notices ?? []).slice(-3)

// ─── O diário da campanha ─────────────────────────────────────────────

/** Linhas do registro que o Papirus escreve sozinho e não contam a história. */
const BOOKKEEPING = [/^Rodada \d+$/, /^Teste pedido:/, /fica de fora desta sessão/, /^O mestre conduz /, / volta a jogar/]

/**
 * Um rascunho do resumo para os jogadores, a partir das notas do registro (sem rolagens,
 * rodadas e chamada). O mestre revisa antes de publicar: nada sai sozinho.
 */
export function draftRecap(s: Session): string {
  return playedLog(s)
    .filter((l) => l.kind === 'nota' && !BOOKKEEPING.some((re) => re.test(l.text)))
    .map((l) => l.text.replace(/^Aviso à mesa: /, '').trim())
    .filter(Boolean)
    .join('\n')
}
