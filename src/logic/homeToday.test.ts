import { describe, expect, it } from 'vitest'
import { docFromParagraphs } from '../model/sample'
import { addScene, addStory, createUniverse, removeScene, updateScene } from '../model/universe'
import { bookGoal, nextNoteOf, setNextNote, streakLine, todayTarget, weekDots, worldCounts } from './homeToday'
import { todayKey } from './stats'

const now = new Date('2026-11-07T15:00:00')
const day = (offset: number) => {
  const d = new Date(now)
  d.setDate(d.getDate() + offset)
  return todayKey(d)
}

/** Um universo com uma cena de tantas palavras. */
function withWords(n: number) {
  let u = createUniverse('Teste')
  let story, scene
  ;[u, story] = addStory(u, 'O Sal')
  ;[u, scene] = addScene(u, story.id, 'A chegada')
  const text = Array.from({ length: n }, () => 'mar').join(' ')
  u = updateScene(u, scene.id, { doc: docFromParagraphs([text]), text })
  return { u, scene }
}

describe('o Início', () => {
  it('guarda o bilhete para amanhã ligado à cena, e apaga com texto vazio', () => {
    const { u, scene } = withWords(3)
    expect(nextNoteOf(u)).toBeNull()
    const with1 = setNextNote(u, '  Kael sobe   no navio. ', scene.id, now)
    expect(nextNoteOf(with1)).toEqual({ text: 'Kael sobe no navio.', sceneId: scene.id, at: now.toISOString() })
    expect(nextNoteOf(setNextNote(with1, '   ', scene.id))).toBeNull()
    // Se a cena some, o bilhete fica, solto.
    expect(nextNoteOf(removeScene(with1, scene.id))?.sceneId).toBeNull()
  })

  it('a meta de hoje é a do dia; sem ela, a que sai do prazo do livro', () => {
    const { u } = withWords(100)
    expect(todayTarget(u, now)).toEqual({ target: 0, until: null })
    expect(todayTarget({ ...u, settings: { ...u.settings, dailyWordGoal: 500 } }, now)).toEqual({ target: 500, until: null })
    // 1.000 palavras até daqui a 9 dias (10 contando hoje), com 100 escritas: 90 por dia.
    const deadline = { ...u, settings: { ...u.settings, deadline: { words: 1000, date: day(9) } } }
    expect(todayTarget(deadline, now)).toEqual({ target: 90, until: day(9) })
  })

  it('a sequência conta os dias; depois de um dia sem escrever, hoje conta', () => {
    const { u } = withWords(10)
    expect(streakLine(u, now)).toBeNull()
    // Hoje, nada antes: 1 dia. Anteontem e ontem, 5 palavras cada: 2 dias seguidos (hoje ainda nada).
    expect(streakLine({ ...u, dailyStart: { [day(0)]: 0 } }, now)).toEqual({ streak: 1, text: '1 dia seguido' })
    expect(streakLine({ ...u, dailyStart: { [day(-2)]: 0, [day(-1)]: 5 } }, now)).toEqual({ streak: 2, text: '2 dias seguidos' })
    // Anteontem escreveu; ontem não: nada de recomeçar do zero.
    expect(streakLine({ ...u, dailyStart: { [day(-3)]: 0, [day(-2)]: 10 } }, now)).toEqual({ streak: 0, text: 'Ontem não deu? Hoje conta.' })
    const week = weekDots({ ...u, dailyStart: { [day(-1)]: 0 } }, now)
    expect(week).toHaveLength(7)
    expect(week.at(-1)).toMatchObject({ day: day(0), today: true })
    expect(week.at(-2)).toMatchObject({ day: day(-1), words: 10, today: false })
  })

  it('o mundo numa linha: só o que tem alguma coisa, sem o que está escondido', () => {
    const empty = createUniverse('Vazio')
    expect(worldCounts(empty)).toEqual([])
    const { u } = withWords(7)
    expect(worldCounts(u)).toEqual([{ view: 'livro', text: '1 cena, 7 palavras' }])
    const withMap = { ...u, maps: [...u.maps, { ...structuredClone(u.maps[0] ?? {}), id: 'm1' } as (typeof u.maps)[number]] }
    expect(worldCounts(withMap).map((w) => w.view)).toEqual(['atlas', 'livro'])
    expect(worldCounts(withMap, ['atlas']).map((w) => w.view)).toEqual(['livro'])
  })
})

describe('palavras e meta do livro escolhido', () => {
  /** Dois livros: 120 palavras no primeiro e 30 no segundo. */
  function twoBooks() {
    let u = createUniverse('Série')
    let a, b, s1, s2
    ;[u, a] = addStory(u, 'Livro um')
    ;[u, b] = addStory(u, 'Livro dois')
    ;[u, s1] = addScene(u, a.id, 'Cena 1')
    ;[u, s2] = addScene(u, b.id, 'Cena 2')
    const text = (n: number) => Array.from({ length: n }, () => 'mar').join(' ')
    u = updateScene(u, s1.id, { doc: docFromParagraphs([text(120)]), text: text(120) })
    u = updateScene(u, s2.id, { doc: docFromParagraphs([text(30)]), text: text(30) })
    return { u, a, b }
  }

  it('sem livro escolhido (ou com um que não existe), não mostra nada', () => {
    const { u } = twoBooks()
    expect(bookGoal(u, null)).toBeNull()
    expect(bookGoal(u, 'nao-existe')).toBeNull()
  })

  it('conta só as palavras do livro, sem meta quando não há prazo', () => {
    const { u, a, b } = twoBooks()
    expect(bookGoal(u, a.id)).toEqual({ words: 120, target: null, left: null, date: null })
    expect(bookGoal(u, b.id)?.words).toBe(30)
  })

  it('com prazo, diz quanto falta para a meta do livro; passada a meta, falta 0', () => {
    const { u, a, b } = twoBooks()
    const withGoal = { ...u, settings: { ...u.settings, deadline: { words: 200, date: '2026-12-20' } } }
    expect(bookGoal(withGoal, a.id)).toEqual({ words: 120, target: 200, left: 80, date: '2026-12-20' })
    expect(bookGoal(withGoal, b.id)?.left).toBe(170)
    const small = { ...u, settings: { ...u.settings, deadline: { words: 100, date: '2026-12-20' } } }
    expect(bookGoal(small, a.id)).toMatchObject({ left: 0, target: 100 })
  })
})
