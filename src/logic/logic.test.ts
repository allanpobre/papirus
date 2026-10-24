import { codexSnapshot } from '../share/snapshot'
import { describe, expect, it } from 'vitest'
import { universeSchema } from '../model/schema'
import { ostriaUniverse as sampleUniverse } from '../model/sampleOstria'
import { addScene, addStory, createUniverse, draftEntity, draftFact, draftRevelation, insert, manuscriptOrder, updateScene } from '../model/universe'
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
    // Mira está em Ostria e na Torre de Marfim, que fica em Ostria: não é estar em dois lugares.
    expect(qs.some((x) => x.type === 'presenca-dupla' && x.entityId === find('Mira').id)).toBe(false)
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
    // O mesmo trecho sustenta dois fatos (sobre o estranho e, em segredo, sobre Vaelor).
    expect(new Set(readerKnowsAt(u, scenes[0].id).map((f) => f.quote))).toEqual(new Set(['Mira jurou que o homem tinha olhos cinzentos']))
    expect(readerKnowsAt(u, scenes[1].id)).toHaveLength(3)
    expect(readerKnowsAt(u, scenes[7].id).length).toBeGreaterThan(readerKnowsAt(u, scenes[3].id).length)
  })
})

describe('Codex dos jogadores', () => {
  const group = u.groups[0]

  it('mostra só o que foi revelado, na profundidade revelada', () => {
    const codex = codexFor(u, group.id)
    expect(codex.entries.map((e) => [e.entity.name, e.depth])).toEqual([
      ['Cassian', 'resumo'],
      ['Homem Pálido', 'resumo'],
      ['Kael', 'resumo'],
      ['Mira', 'resumo'],
      ['Ostria', 'completo'],
      ['Rhea', 'resumo'],
      ['Torre de Marfim', 'resumo'],
      ['Vaelor', 'nome'],
    ])
    const md = codexMarkdown(u, group.id)
    expect(md).toContain('### Vaelor')
    expect(md).not.toContain('Último príncipe')
    expect(md).toContain('Cidade portuária')
    expect(md).toContain('Vaelor tem olhos cinzentos')
    expect(md).toContain('## Ligações')
    expect(md).toContain('- Cassian caça Homem Pálido')
  })

  it('ligações reveladas, sessão a sessão, e o que é novo', () => {
    expect(codexFor(u, group.id, 1).relations.map((r) => r.type).sort()).toEqual(['irmão de', 'trouxe'])
    const all = codexFor(u, group.id)
    expect(all.relations).toHaveLength(3)
    // Na sessão mais recente (2), entrou Cassian e a caça: é o que aparece como novo.
    const cassian = find('Cassian').id
    expect(all.fresh.has(cassian)).toBe(true)
    expect(all.fresh.has(find('Kael').id)).toBe(false)
    // "Com ajuda de Odo" fica de fora: a mesa não conhece Odo.
    const snap = codexSnapshot(u, group.id)
    expect(snap.relations?.find((r) => r.from === 'Cassian')?.text).toBe('Cassian caça Homem Pálido')
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
    expect(searchUniverse(u, 'principe perdido')[0]).toMatchObject({ kind: 'ficha', title: 'Vaelor' })
    expect(searchUniverse(u, 'homem palido')[0]).toMatchObject({ kind: 'ficha', title: 'Homem Pálido' })
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
    expect(longestAbsence(rows, kael)).toBe(2)
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

describe('continuidade: o que o texto e as fichas dizem', () => {
  const base = () => {
    let u = createUniverse('Teste')
    let story
    ;[u, story] = addStory(u, 'Livro')
    let kael
    ;[u, kael] = insert(u, 'entities', { ...draftEntity('personagem', 'Kael'), fields: [{ key: 'Olhos', value: 'Verdes' }] })
    const scene = (title: string, text: string, presentIds: string[] = []) => {
      let s
      ;[u, s] = addScene(u, story.id, title)
      u = updateScene(u, s.id, { text, presentIds })
      return s
    }
    return { get u() { return u }, set u(v) { u = v }, kael, scene }
  }

  it('olhos que mudam de cor entre a ficha e o texto', () => {
    const t = base()
    t.scene('Um', 'Kael olhou para o mar com seus olhos muito azuis. Mira riu.')
    const q = continuityQuestions(t.u).filter((x) => x.type === 'descricao-divergente')
    expect(q).toHaveLength(1)
    expect(q[0].text).toContain('Os olhos de Kael aparecem de jeitos diferentes: verdes na ficha, azuis em “Um”')
  })

  it('quem morreu e aparece depois', () => {
    const t = base()
    const a = t.scene('A batalha', 'Kael caiu.')
    t.scene('Depois', 'Kael abriu a porta.', [t.kael.id])
    ;[t.u] = insert(t.u, 'facts', draftFact({ subjectId: t.kael.id, predicate: 'morreu', value: 'na batalha', sourceSceneId: a.id, canon: 'estabelecido' }))
    const q = continuityQuestions(t.u).filter((x) => x.type === 'morto-reaparece')
    expect(q.map((x) => x.text)).toEqual(['Kael morre em “A batalha”, mas está em “Depois”, depois. Lembrança, fantasma, ou a morte foi falsa?'])
  })

  it('nome escrito quase igual', () => {
    const t = base()
    t.scene('Um', 'Kael chegou. Kael sentou. Kael falou. Depois, Kale saiu.')
    const q = continuityQuestions(t.u).filter((x) => x.type === 'nome-parecido')
    expect(q).toHaveLength(1)
    expect(q[0].text).toContain('“Kale” aparece uma vez')
  })

  it('datas impossíveis', () => {
    const t = base()
    t.u = { ...t.u, entities: t.u.entities.map((e) => ({ ...e, startYear: 300, endYear: 200 })) }
    const q = continuityQuestions(t.u).filter((x) => x.type === 'data-impossivel')
    expect(q[0].text).toContain('termina em 200')
  })

  it('pode ser desligado', () => {
    const t = base()
    t.scene('Um', 'Kael tinha olhos azuis.')
    expect(continuityQuestions(t.u, { 'descricao-divergente': false }).filter((x) => x.type === 'descricao-divergente')).toHaveLength(0)
  })
})
