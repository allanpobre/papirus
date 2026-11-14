import { describe, expect, it } from 'vitest'
import { addScene, addStory, createUniverse, draftEntity, insert, updateScene } from '../model/universe'
import { bookScope, eventBelongs } from './bookScope'

/** Dois livros: Ana só no primeiro, Beto só no segundo, Cris em nenhum (ficha nova), Vila nova é um lugar sem cena. */
function twoBooks() {
  let u = createUniverse('Série')
  let ana, beto, cris, vila
  ;[u, ana] = insert(u, 'entities', draftEntity('personagem', 'Ana'))
  ;[u, beto] = insert(u, 'entities', draftEntity('personagem', 'Beto'))
  ;[u, cris] = insert(u, 'entities', draftEntity('personagem', 'Cris'))
  ;[u, vila] = insert(u, 'entities', draftEntity('lugar', 'Vila Nova'))
  let um, dois
  ;[u, um] = addStory(u, 'Livro um')
  ;[u, dois] = addStory(u, 'Livro dois')
  let s1, s2
  ;[u, s1] = addScene(u, um.id, 'Cena 1')
  ;[u, s2] = addScene(u, dois.id, 'Cena 2')
  u = updateScene(u, s1.id, { text: 'Ana saiu cedo.' })
  u = updateScene(u, s2.id, { text: 'Beto chegou tarde.' })
  return { u, um, dois, ana, beto, cris, vila }
}

describe('quem vale para o livro escolhido', () => {
  it('sem livro, nada é filtrado', () => {
    const { u } = twoBooks()
    expect(bookScope(u, null)).toBeNull()
  })

  it('vale quem aparece no livro e quem ainda não aparece em livro nenhum', () => {
    const { u, um, dois, ana, beto, cris, vila } = twoBooks()
    const livroUm = bookScope(u, um.id)!
    expect(livroUm.belongs(ana.id)).toBe(true)
    expect(livroUm.belongs(beto.id)).toBe(false)
    // Fichas novas (nem em cena nenhuma) valem para qualquer livro.
    expect(livroUm.belongs(cris.id)).toBe(true)
    expect(livroUm.belongs(vila.id)).toBe(true)
    expect(livroUm.inNoBook(cris.id)).toBe(true)
    expect(livroUm.inNoBook(ana.id)).toBe(false)
    expect(livroUm.inBook(cris.id)).toBe(false)

    const livroDois = bookScope(u, dois.id)!
    expect(livroDois.belongs(beto.id)).toBe(true)
    expect(livroDois.belongs(ana.id)).toBe(false)
    expect(livroDois.belongs(vila.id)).toBe(true)
  })

  it('quando a ficha nova entra numa cena, passa a valer só para aquele livro', () => {
    const { u, um, dois, cris } = twoBooks()
    const cena = u.scenes.find((s) => s.storyId === dois.id)!
    const depois = updateScene(u, cena.id, { text: 'Beto chegou tarde com Cris.' })
    expect(bookScope(depois, dois.id)!.belongs(cris.id)).toBe(true)
    expect(bookScope(depois, um.id)!.belongs(cris.id)).toBe(false)
  })
})

describe('eventos da Linha do tempo com um livro', () => {
  it('fica o que não tem ninguém, o de quem vale e o de um lugar novo; some o de quem só está em outro livro', () => {
    const { u, um, ana, beto, vila } = twoBooks()
    const scope = bookScope(u, um.id)
    expect(eventBelongs({ entityIds: [], placeId: null }, scope)).toBe(true)
    expect(eventBelongs({ entityIds: [ana.id], placeId: null }, scope)).toBe(true)
    expect(eventBelongs({ entityIds: [beto.id], placeId: null }, scope)).toBe(false)
    // Lugar novo (sem cena em livro nenhum): o evento não fica apagado.
    expect(eventBelongs({ entityIds: [beto.id], placeId: vila.id }, scope)).toBe(true)
    expect(eventBelongs({ entityIds: [], placeId: vila.id }, scope)).toBe(true)
    // Sem livro, tudo vale.
    expect(eventBelongs({ entityIds: [beto.id], placeId: null }, null)).toBe(true)
  })
})
