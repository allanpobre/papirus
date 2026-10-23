import { describe, expect, it } from 'vitest'
import { universeSchema } from '../model/schema'
import { sampleUniverse } from '../model/sample'
import { insert, manuscriptOrder, draftRevelation } from '../model/universe'
import { codexFor, codexMarkdown, factSentence } from './codex'
import { continuityQuestions, isOpen } from './continuity'
import { DiceError, roll } from './dice'
import { forceLayout, neighborhood } from './graph'
import { knowledgeAt, readerKnowsAt } from './knowledge'
import { searchUniverse } from './search'
import { longestAbsence, presenceMatrix } from './stats'

const u = sampleUniverse()
const find = (name: string) => u.entities.find((e) => e.name === name)!

describe('universo de exemplo', () => {
  it('é válido pelo schema', () => {
    expect(universeSchema.safeParse(u).success).toBe(true)
  })
})

describe('continuidade', () => {
  const qs = continuityQuestions(u)

  it('pergunta sobre personagem que aparece depois do fim registrado', () => {
    const q = qs.find((x) => x.type === 'apos-fim' && x.entityId === find('Ilsa').id)
    expect(q?.text).toMatch(/Ilsa aparece em “A Torre fechada”/)
  })

  it('pergunta sobre lugar que já não existia', () => {
    expect(qs.some((x) => x.type === 'apos-fim' && x.entityId === find('Reino de Ostria').id)).toBe(false)
    expect(qs.some((x) => x.type === 'apos-fim' && x.text.includes('deixou de existir'))).toBe(false)
  })

  it('pergunta sobre presença em dois lugares no mesmo dia', () => {
    const q = qs.find((x) => x.type === 'presenca-dupla' && x.entityId === find('Kael').id)
    expect(q?.text).toMatch(/Kael está em Ostria .* e em Vale das Brumas/)
    expect(qs.some((x) => x.type === 'presenca-dupla' && x.entityId === find('Mira').id)).toBe(true)
  })

  it('pergunta sobre fatos estabelecidos que divergem', () => {
    expect(qs.some((x) => x.type === 'fatos-divergentes' && x.entityId === find('Ilsa').id)).toBe(true)
  })

  it('respeita respostas e tipos desligados', () => {
    const q = qs.find((x) => x.type === 'apos-fim')!
    const answered = { ...u, continuity: [{ key: q.key, answer: 'intencional' as const, note: '', at: '' }] }
    const again = continuityQuestions(answered).find((x) => x.key === q.key)!
    expect(isOpen(again)).toBe(false)
    expect(continuityQuestions(u, { 'apos-fim': false }).some((x) => x.type === 'apos-fim')).toBe(false)
  })
})

describe('conhecimento', () => {
  const scenes = manuscriptOrder(u)

  it('o que o POV sabe depende do ponto da história', () => {
    const mira = find('Mira').id
    expect(knowledgeAt(u, mira, scenes[0].id)).toHaveLength(0)
    expect(knowledgeAt(u, mira, scenes[1].id).map((k) => k.entry.state)).toEqual(['suspeita'])
    expect(knowledgeAt(u, find('Ilsa').id, scenes[0].id)).toHaveLength(1)
  })

  it('o leitor só sabe fatos com fonte em cenas já lidas', () => {
    expect(readerKnowsAt(u, scenes[0].id).map((f) => f.quote)).toEqual([
      'Mira jurou que o homem tinha olhos cinzentos',
    ])
    expect(readerKnowsAt(u, scenes[1].id)).toHaveLength(2)
  })
})

describe('Codex dos jogadores', () => {
  const group = u.groups[0]

  it('mostra só o que foi revelado, na profundidade revelada', () => {
    const codex = codexFor(u, group.id)
    expect(codex.entries.map((e) => [e.entity.name, e.depth])).toEqual([
      ['Kael', 'resumo'],
      ['Ostria', 'completo'],
      ['Torre de Marfim', 'resumo'],
      ['Vaelor', 'nome'],
    ])
    const md = codexMarkdown(u, group.id)
    expect(md).toContain('### Vaelor')
    expect(md).not.toContain('Último príncipe')
    expect(md).toContain('Cidade portuária')
    expect(md).toContain('Vaelor tem olhos cinzentos')
  })

  it('usa a revelação mais profunda e filtra por sessão', () => {
    const s2 = u.sessions.find((s) => s.number === 2)!
    const [deeper] = insert(u, 'revelations', { ...draftRevelation(group.id, 'entidade', find('Vaelor').id, s2.id), depth: 'completo' })
    expect(codexFor(deeper, group.id).entries.find((e) => e.entity.name === 'Vaelor')?.depth).toBe('completo')
    expect(codexFor(deeper, group.id, 1).entries.find((e) => e.entity.name === 'Vaelor')?.depth).toBe('nome')
    expect(codexFor(deeper, group.id, 0).entries).toHaveLength(0)
  })

  it('escreve fatos como frase', () => {
    expect(factSentence(u, u.facts[0])).toBe('Vaelor tem olhos cinzentos')
  })
})

describe('dados', () => {
  const fixed = (values: number[]) => {
    let i = 0
    return () => values[i++ % values.length]
  }

  it('rola expressões com modificadores', () => {
    const r = roll('2d6+3', fixed([0, 0.99]))
    expect(r.parts[0].rolls).toEqual([1, 6])
    expect(r.total).toBe(10)
  })

  it('mantém os maiores', () => {
    const r = roll('4d6kh3', fixed([0, 0.5, 0.99, 0.2]))
    expect(r.parts[0].kept).toEqual([6, 4, 2])
    expect(r.total).toBe(12)
  })

  it('aceita d20, d% e subtração', () => {
    expect(roll('d20-1', fixed([0.5])).total).toBe(10)
    expect(roll('d%', fixed([0])).total).toBe(1)
  })

  it.each(['', 'abc', '2d', '0d6', '1d1', '999d6', '2d6++'])('recusa “%s”', (e) => {
    expect(() => roll(e)).toThrow(DiceError)
  })
})

describe('grafo', () => {
  it('posiciona todos os nós dentro da área, de forma determinística', () => {
    const nodes = ['a', 'b', 'c', 'd'].map((id) => ({ id }))
    const edges = [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'c' },
    ]
    const p1 = forceLayout(nodes, edges, { width: 400, height: 300 })
    const p2 = forceLayout(nodes, edges, { width: 400, height: 300 })
    expect([...p1.values()]).toEqual([...p2.values()])
    for (const p of p1.values()) {
      expect(p.x).toBeGreaterThanOrEqual(0)
      expect(p.x).toBeLessThanOrEqual(400)
      expect(p.y).toBeGreaterThanOrEqual(0)
      expect(p.y).toBeLessThanOrEqual(300)
    }
  })

  it('calcula a vizinhança por profundidade', () => {
    const edges = [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'c' },
      { from: 'c', to: 'd' },
    ]
    expect([...neighborhood('b', edges, 1)].sort()).toEqual(['a', 'b', 'c'])
    expect([...neighborhood('a', edges, 2)].sort()).toEqual(['a', 'b', 'c'])
  })
})

describe('busca', () => {
  it('encontra fichas por apelido sem acento', () => {
    const r = searchUniverse(u, 'homem palido')
    expect(r[0]).toMatchObject({ kind: 'ficha', title: 'Vaelor' })
  })

  it('encontra trechos de cenas', () => {
    const r = searchUniverse(u, 'trezentos e doze')
    expect(r.some((x) => x.kind === 'cena' && x.title === 'A Torre fechada')).toBe(true)
  })
})

describe('ritmo e presença', () => {
  it('distingue POV, presença e menção', () => {
    const { rows, columns } = presenceMatrix(u)
    const kael = find('Kael').id
    const vaelor = find('Vaelor').id
    expect(rows[0].cells.get(kael)).toBe('pov')
    expect(rows[0].cells.get(vaelor)).toBe('presente')
    expect(columns[0].name).toBe('Kael')
    expect(longestAbsence(rows, kael)).toBe(1)
  })
})

describe('Codex: eventos, pistas, mapas e fichas do grupo', () => {
  it('mostra só o que foi revelado de cada tipo', async () => {
    const { draftMap, newId } = await import('../model/universe')
    let v = u
    const group = v.groups[0]
    const queda = v.events.find((e) => e.title === 'A Queda')!
    const misterio = v.seeds.find((s) => s.kind === 'misterio')!
    const pinOstria = { id: newId(), entityId: find('Ostria').id, x: 0.5, y: 0.5, label: '' }
    const pinBrumas = { id: newId(), entityId: find('Vale das Brumas').id, x: 0.2, y: 0.2, label: '' }
    const pinTorre = { id: newId(), entityId: find('Torre de Marfim').id, x: 0.4, y: 0.4, label: '' }
    let map
    ;[v, map] = insert(v, 'maps', { ...draftMap('Costa', 'data:,', 10, 10), pins: [pinOstria, pinBrumas, pinTorre] })
    for (const [target, id] of [
      ['evento', queda.id],
      ['pista', misterio.clues[0].id],
      ['mapa', map.id],
      ['marcador', pinBrumas.id],
    ] as const) {
      ;[v] = insert(v, 'revelations', draftRevelation(group.id, target, id, null))
    }
    const codex = codexFor(v, group.id)
    expect(codex.events.map((e) => e.title)).toEqual(['A Queda'])
    expect(codex.clues.map((c) => c.clue.text)).toEqual([misterio.clues[0].text])
    // Brumas foi revelado como marcador; Ostria e a Torre porque as fichas são conhecidas.
    expect(codex.maps[0].pins.map((p) => p.id).sort()).toEqual([pinOstria.id, pinBrumas.id, pinTorre.id].sort())
    expect(codex.sheets.map((s) => s.name)).toEqual(['Brisa', 'Taren', 'Ilmar'])

    const md = codexMarkdown(v, group.id)
    expect(md).toContain('## Linha do tempo')
    expect(md).toContain('A Queda')
    expect(md).toContain('## Pistas')
    expect(md).toContain('## O grupo')
    expect(md).toContain('### Brisa (Ana)')
  })

  it('a mesa pode esconder as fichas do grupo', () => {
    const group = { ...u.groups[0], showSheetsInCodex: false }
    const v = { ...u, groups: [group] }
    expect(codexFor(v, group.id).sheets).toEqual([])
  })
})

describe('mentiras no Codex', () => {
  it('a mesa vê quem disse, nunca que é falso', async () => {
    const { draftFact } = await import('../model/universe')
    const { playerTag } = await import('./codex')
    const group = u.groups[0]
    const [v, lie] = insert(u, 'facts', draftFact({ subjectId: find('Kael').id, predicate: 'é filho de', value: 'um pescador', speakerId: find('Mira').id, canon: 'falso' }))
    const [w] = insert(v, 'revelations', draftRevelation(group.id, 'fato', lie.id, null))
    expect(playerTag(w, lie)).toBe('segundo Mira')
    const md = codexMarkdown(w, group.id)
    expect(md).toContain('Kael é filho de um pescador _(segundo Mira)_')
    expect(md).not.toMatch(/falso/i)
  })
})

describe('palavras por dia', () => {
  it('conta cada dia pelo início do dia seguinte e hoje pelo total', async () => {
    const { wordsByDay } = await import('./stats')
    const { countWords } = await import('../persistence/repository')
    const total = countWords(u)
    const v = { ...u, dailyStart: { '2026-10-20': total - 300, '2026-10-22': total - 50, '2026-10-23': total - 20 } }
    const days = wordsByDay(v, 4, new Date(2026, 9, 23, 12))
    expect(days).toEqual([
      { day: '2026-10-20', words: 250 },
      { day: '2026-10-21', words: 0 },
      { day: '2026-10-22', words: 30 },
      { day: '2026-10-23', words: 20 },
    ])
  })
})
