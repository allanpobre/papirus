import { describe, expect, it } from 'vitest'
import { docFromParagraphs } from '../../model/sample'
import { addScene, addStory, createUniverse, updateScene } from '../../model/universe'
import { newSprint, sprintGain } from './sprintClock'

/** Dois livros: 100 palavras no primeiro e 40 no segundo. */
function twoBooks() {
  let u = createUniverse('Série')
  let a, b, s1, s2
  ;[u, a] = addStory(u, 'Livro um')
  ;[u, b] = addStory(u, 'Livro dois')
  ;[u, s1] = addScene(u, a.id, 'Cena 1')
  ;[u, s2] = addScene(u, b.id, 'Cena 2')
  const text = (n: number) => Array.from({ length: n }, () => 'mar').join(' ')
  u = updateScene(u, s1.id, { doc: docFromParagraphs([text(100)]), text: text(100) })
  u = updateScene(u, s2.id, { doc: docFromParagraphs([text(40)]), text: text(40) })
  return { u, a, b, s1, s2, text }
}

describe('sprint de escrita com livro escolhido', () => {
  it('conta só as palavras do livro do sprint, não as do outro', () => {
    const { u, a, b, s1, s2, text } = twoBooks()
    const sprint = newSprint(u, 15, a.id, 1_000)
    expect(sprint).toMatchObject({ bookId: a.id, startWords: 100, minutes: 15, endsAt: 1_000 + 15 * 60_000 })
    // Escreve 30 palavras no outro livro: não conta.
    const outro = updateScene(u, s2.id, { text: text(70), doc: docFromParagraphs([text(70)]) })
    expect(sprintGain(outro, sprint)).toBe(0)
    // Escreve 25 no livro do sprint: conta só essas.
    const mesmo = updateScene(outro, s1.id, { text: text(125), doc: docFromParagraphs([text(125)]) })
    expect(sprintGain(mesmo, sprint)).toBe(25)
    // Um sprint do outro livro (que ganhou 30 palavras) vê só as dele, sem as 25 do primeiro.
    expect(sprintGain(mesmo, newSprint(u, 15, b.id))).toBe(30)
  })

  it('sem livro escolhido, conta o universo todo; e apagar texto nunca dá número negativo', () => {
    const { u, s1, text } = twoBooks()
    const sprint = newSprint(u, 10, null)
    expect(sprint.startWords).toBe(140)
    const mais = updateScene(u, s1.id, { text: text(110), doc: docFromParagraphs([text(110)]) })
    expect(sprintGain(mais, sprint)).toBe(10)
    const menos = updateScene(u, s1.id, { text: text(20), doc: docFromParagraphs([text(20)]) })
    expect(sprintGain(menos, sprint)).toBe(0)
  })

  it('trocar de livro no meio não muda de que livro o sprint conta (fica guardado nele)', () => {
    const { u, a, s1, text } = twoBooks()
    const sprint = newSprint(u, 15, a.id)
    const depois = updateScene(u, s1.id, { text: text(103), doc: docFromParagraphs([text(103)]) })
    // O sprint carrega o próprio livro: nenhuma outra escolha na tela o altera.
    expect(sprint.bookId).toBe(a.id)
    expect(sprintGain(depois, sprint)).toBe(3)
  })
})
