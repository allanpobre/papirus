import { describe, expect, it } from 'vitest'
import { addScene, addStory, createUniverse, draftFact, insert } from '../model/universe'
import type { Universe } from '../model/schema'
import { revealedInBook, revealWhere } from './knowledge'

/** Uma série de dois livros: um fato revelado em cada um, e um fato só do autor (sem cena). */
function serie() {
  let u: Universe = createUniverse('Série')
  let l1, l2, c1, c2
  ;[u, l1] = addStory(u, 'Livro um')
  ;[u, c1] = addScene(u, l1.id, 'A chegada')
  ;[u, l2] = addStory(u, 'Livro dois')
  ;[u, c2] = addScene(u, l2.id, 'A volta')
  let f1, f2, f3
  ;[u, f1] = insert(u, 'facts', draftFact({ predicate: 'chegou ao porto', sourceSceneId: c1.id }))
  ;[u, f2] = insert(u, 'facts', draftFact({ predicate: 'voltou ao reino', sourceSceneId: c2.id }))
  ;[u, f3] = insert(u, 'facts', draftFact({ predicate: 'guarda um segredo', sourceSceneId: null }))
  return { u, l1, l2, c1, c2, f1, f2, f3 }
}

describe('fatos e livros', () => {
  it('"Revelados neste livro": só os fatos que vêm de cenas dele', () => {
    const { u, l1, l2, f1, f2 } = serie()
    expect(revealedInBook(u, l1.id).map((f) => f.id)).toEqual([f1.id])
    expect(revealedInBook(u, l2.id).map((f) => f.id)).toEqual([f2.id])
    // Um livro sem cena nenhuma não revela nada.
    expect(revealedInBook(u, 'outro')).toEqual([])
  })

  it('em cada fato: neste livro, num livro anterior, num livro que vem depois, ou sem cena', () => {
    const { u, l1, l2, c1, f1, f2, f3 } = serie()
    expect(revealWhere(u, f1, l1.id)).toMatchObject({ kind: 'neste', scene: { id: c1.id }, book: { id: l1.id } })
    // Visto do livro dois: o fato do livro um já era sabido; o do livro dois é "neste".
    expect(revealWhere(u, f1, l2.id)).toMatchObject({ kind: 'antes', book: { title: 'Livro um' } })
    expect(revealWhere(u, f2, l2.id).kind).toBe('neste')
    // Visto do livro um: o do livro dois só vem depois.
    expect(revealWhere(u, f2, l1.id)).toMatchObject({ kind: 'depois', book: { title: 'Livro dois' } })
    // Sem livro escolhido, só diz onde: em tal cena, de tal livro.
    expect(revealWhere(u, f2, null)).toMatchObject({ kind: 'em', scene: { title: 'A volta' }, book: { title: 'Livro dois' } })
    // Fato do autor, sem cena.
    expect(revealWhere(u, f3, l1.id)).toEqual({ kind: 'sem-cena' })
    expect(revealWhere(u, f3, null)).toEqual({ kind: 'sem-cena' })
  })

  it('uma cena que sumiu conta como sem cena', () => {
    const { u, l1, f1 } = serie()
    const semCena = { ...u, scenes: [] }
    expect(revealWhere(semCena, f1, l1.id)).toEqual({ kind: 'sem-cena' })
  })
})
