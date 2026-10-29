import { describe, expect, it } from 'vitest'
import type { Universe } from '../model/schema'
import { byId, createUniverse, draftGroup, draftSession, insert, newId, patch } from '../model/universe'
import { beginSession, durationLabel, END_NOTE, finishSession, playedLog, sessionName, sessionSummary, sessionToStart, START_NOTE } from './sessionLife'

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
