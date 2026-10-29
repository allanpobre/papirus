import { describe, expect, it } from 'vitest'
import type { Universe } from '../model/schema'
import { byId, createUniverse, draftEntity, draftGroup, draftSession, insert, newId, patch } from '../model/universe'
import { draftSheet } from './sheets'
import {
  announce,
  attendanceOf,
  beginSession,
  durationLabel,
  END_NOTE,
  finishSession,
  playedLog,
  recentNotices,
  rollCall,
  sessionName,
  sessionSummary,
  sessionToStart,
  setAttendance,
  START_NOTE,
  sendToRoteiro,
} from './sessionLife'

function table(): [Universe, string] {
  const [u, g] = insert(createUniverse('Ostria'), 'groups', draftGroup('Mesa de sexta'))
  return [u, g.id]
}

describe('começo e fim da sessão', () => {
  it('sem sessão planejada, começar cria a próxima', () => {
    let [u, groupId] = table()
    ;[u] = insert(u, 'sessions', { ...draftSession(1, groupId), status: 'encerrada' })
    expect(sessionToStart(u, groupId)).toEqual({ id: null, number: 2, title: 'Sessão 2' })
    const [next, id] = beginSession(u, groupId, null, new Date('2026-10-29T22:00:00Z'))
    const s = byId(next, 'sessions', id)!
    expect(s.number).toBe(2)
    expect(s.status).toBe('em-andamento')
    expect(s.startedAt).toBe('2026-10-29T22:00:00.000Z')
    expect(s.log.map((l) => l.text)).toEqual([START_NOTE])
  })

  it('começa a planejada, e retomar não repete a linha do começo', () => {
    let [u, groupId] = table()
    let planned
    ;[u, planned] = insert(u, 'sessions', draftSession(1, groupId))
    expect(sessionToStart(u, groupId).id).toBe(planned.id)
    ;[u] = beginSession(u, groupId, planned.id)
    ;[u] = beginSession(u, groupId, planned.id)
    expect(byId(u, 'sessions', planned.id)!.log.filter((l) => l.text === START_NOTE)).toHaveLength(1)
  })

  it('ao encerrar, o registro vai para Ideias só se algo aconteceu', () => {
    let [u, groupId] = table()
    let id
    ;[u, id] = beginSession(u, groupId, null)
    const empty = finishSession(u, id, 'Mesa de sexta')
    expect(empty.sent).toBe(false)
    expect(empty.universe.inbox).toHaveLength(0)
    expect(byId(empty.universe, 'sessions', id)!.log.at(-1)!.text).toBe(END_NOTE)

    const s = byId(u, 'sessions', id)!
    u = patch(u, 'sessions', id, { log: [...s.log, { id: newId(), at: '20:10', text: 'Entraram na torre.', kind: 'nota' }] })
    const done = finishSession(u, id, 'Mesa de sexta')
    expect(done.sent).toBe(true)
    expect(byId(done.universe, 'sessions', id)!.status).toBe('encerrada')
    expect(done.universe.inbox[0].text).toContain('Sessão 1 — Mesa de sexta')
    expect(done.universe.inbox[0].text).toContain('Entraram na torre.')
    expect(playedLog(byId(done.universe, 'sessions', id)!).map((l) => l.text)).toEqual(['Entraram na torre.'])
  })

  it('o resumo do fim: duração, rolagens, notas e revelações', () => {
    let [u, groupId] = table()
    let id
    ;[u, id] = beginSession(u, groupId, null, new Date('2026-10-29T22:00:00Z'))
    const s = byId(u, 'sessions', id)!
    u = patch(u, 'sessions', id, {
      log: [
        ...s.log,
        { id: newId(), at: '19:05', text: 'Taren — Espada: 19', kind: 'rolagem' },
        { id: newId(), at: '19:06', text: 'Rodada 2', kind: 'nota' },
        { id: newId(), at: '19:10', text: 'Ilsa apareceu.', kind: 'nota' },
      ],
    })
    expect(sessionSummary(u, byId(u, 'sessions', id)!, Date.parse('2026-10-29T23:35:00Z'))).toEqual({ minutes: 95, rolls: 1, notes: 1, revelations: 0 })
    expect(durationLabel(95)).toBe('1 h 35 min')
    expect(durationLabel(120)).toBe('2 h')
    expect(durationLabel(40)).toBe('40 min')
    expect(durationLabel(0)).toBe('< 1 min')
  })

  it('o nome próprio da sessão, sem repetir o número', () => {
    expect(sessionName(2, 'Sessão 2 — A Torre')).toBe('A Torre')
    expect(sessionName(2, 'Sessão 2: A Torre')).toBe('A Torre')
    expect(sessionName(2, 'Sessão 2')).toBeNull()
    expect(sessionName(2, 'A Torre')).toBe('A Torre')
    expect(sessionName(2, 'Sessão 20')).toBe('Sessão 20')
  })
})

describe('quem joga nesta sessão', () => {
  function withParty(): [Universe, string, string, string] {
    let [u, groupId] = table()
    let taren
    ;[u, taren] = insert(u, 'sheets', draftSheet('Taren', null, { groupId, player: 'Bruno' }))
    ;[u] = insert(u, 'sheets', draftSheet('Brisa', null, { groupId, player: 'Ana' }))
    let id
    ;[u, id] = beginSession(u, groupId, null)
    return [u, groupId, id, taren.id]
  }

  it('sem marcar, todos jogam; quem não veio fica de fora ou o mestre conduz, e fica no registro', () => {
    let [u, , id, taren] = withParty()
    expect(attendanceOf(byId(u, 'sessions', id), taren)).toBe('joga')
    u = setAttendance(u, id, taren, 'fora')
    expect(attendanceOf(byId(u, 'sessions', id), taren)).toBe('fora')
    expect(byId(u, 'sessions', id)!.log.at(-1)!.text).toBe('Taren fica de fora desta sessão (Bruno não veio).')
    u = setAttendance(u, id, taren, 'mestre')
    expect(byId(u, 'sessions', id)!.log.at(-1)!.text).toBe('O mestre conduz Taren nesta sessão (Bruno não veio).')
    u = setAttendance(u, id, taren, 'joga')
    expect(byId(u, 'sessions', id)!.attendance).toEqual({})
    expect(byId(u, 'sessions', id)!.log.at(-1)!.text).toBe('Taren volta a jogar com Bruno.')
  })

  it('a chamada vai junto com o registro para Ideias', () => {
    let [u, , id, taren] = withParty()
    u = setAttendance(u, id, taren, 'mestre')
    expect(rollCall(u, byId(u, 'sessions', id)!)).toBe('Na mesa: Brisa (Ana) · O mestre conduziu: Taren (Bruno)')
    const done = finishSession(u, id, 'Mesa de sexta')
    expect(done.universe.inbox[0].text.split('\n')[1]).toBe('Na mesa: Brisa (Ana) · O mestre conduziu: Taren (Bruno)')
  })
})

describe('avisos do mestre', () => {
  it('o aviso fica na sessão e no registro; quem aparece ganha o nome no Codex e entra na iniciativa', () => {
    let [u, groupId] = table()
    let id
    ;[u, id] = beginSession(u, groupId, null)
    let boss
    ;[u, boss] = insert(u, 'entities', draftEntity('personagem', 'Homem Pálido'))
    const [next, notice] = announce(u, id, '  Um inimigo aparece!  ', 'perigo', { entityId: boss.id, reveal: true, fight: true }, new Date('2026-10-29T22:10:00Z'))
    expect(notice).toMatchObject({ text: 'Um inimigo aparece!', tone: 'perigo', at: '2026-10-29T22:10:00.000Z' })
    const s = byId(next, 'sessions', id)!
    expect(recentNotices(s).map((n) => n.text)).toEqual(['Um inimigo aparece!'])
    expect(s.log.at(-1)!.text).toBe('Aviso à mesa: Um inimigo aparece!')
    expect(s.initiative.map((i) => i.name)).toEqual(['Homem Pálido'])
    expect(next.revelations).toMatchObject([{ groupId, target: 'entidade', targetId: boss.id, depth: 'nome', sessionId: id }])

    // De novo: não revela nem entra na iniciativa duas vezes.
    const [again] = announce(next, id, 'Ele volta!', 'perigo', { entityId: boss.id, reveal: true, fight: true })
    expect(byId(again, 'sessions', id)!.initiative).toHaveLength(1)
    expect(again.revelations).toHaveLength(1)
    expect(recentNotices(byId(again, 'sessions', id))).toHaveLength(2)
  })

  it('aviso vazio não sai', () => {
    let [u, groupId] = table()
    let id
    ;[u, id] = beginSession(u, groupId, null)
    expect(announce(u, id, '   ', 'aviso')).toEqual([u, null])
  })
})

describe('da Oficina para o Roteiro', () => {
  it('o início forte e as cenas vão para a próxima sessão, criada se preciso', () => {
    let [u, groupId] = table()
    expect(sendToRoteiro(createUniverse('Sem mesa'), 'inicio', 'A ponte estala.')).toBeNull()
    ;[u] = insert(u, 'sessions', { ...draftSession(1, groupId), status: 'encerrada' })
    const sent = sendToRoteiro(u, 'inicio', 'A ponte estala.')!
    expect(sent[1]).toBe('sessão 2')
    u = sent[0]
    const s2 = u.sessions.find((s) => s.number === 2)!
    expect(s2).toMatchObject({ status: 'planejada', strongStart: 'A ponte estala.' })
    // Na mesma sessão planejada: cada linha vira uma cena do roteiro.
    ;[u] = sendToRoteiro(u, 'cena', '1. A vila sem sinos\n- O mapa do contrabandista\n\n')!
    expect(byId(u, 'sessions', s2.id)!.beats.map((b) => b.title)).toEqual(['A vila sem sinos', 'O mapa do contrabandista'])
    expect(u.sessions).toHaveLength(2)
  })
})
