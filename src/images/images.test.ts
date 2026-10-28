import { describe, expect, it } from 'vitest'
import { epubImageFiles } from '../export/epubImages'
import { createUniverse } from '../model/universe'
import { applyMoved } from './inline'
import { idToRef, imageIdsIn, isImageRef } from './ref'

const A = 'a'.repeat(32)
const B = 'b'.repeat(32)

describe('referências de imagem', () => {
  it('reconhece só "img:" com o id do conteúdo', () => {
    expect(isImageRef(idToRef(A))).toBe(true)
    expect(isImageRef('img:123')).toBe(false)
    expect(isImageRef('data:image/png;base64,xx')).toBe(false)
  })

  it('acha as imagens em qualquer lugar do universo (fichas, capa, cenas, lixeira)', () => {
    const u = createUniverse('Teste')
    const withImages = {
      ...u,
      settings: { ...u.settings, cover: idToRef(A) },
      scenes: [{ doc: { type: 'doc', content: [{ type: 'image', attrs: { src: idToRef(B) } }] } }],
      trash: [{ records: { entities: [{ id: 'x', image: idToRef(A) }] } }],
    }
    expect([...imageIdsIn(withImages)].sort()).toEqual([A, B])
  })

  it('troca a imagem embutida do mapa pela referência, só onde ainda é a mesma', () => {
    const u = createUniverse('Mapas')
    const map = { id: 'm1', name: 'Mapa', image: 'data:image/jpeg;base64,AAAA', width: 10, height: 10, pins: [], createdAt: '', updatedAt: '' }
    const other = { ...map, id: 'm2', image: 'data:image/jpeg;base64,BBBB' }
    const out = applyMoved({ ...u, maps: [map, other] }, new Map([[map.image, idToRef(A)]]))
    expect(out.maps.map((m) => m.image)).toEqual([idToRef(A), other.image])
    const same = { ...u, maps: [other] }
    expect(applyMoved(same, new Map([[map.image, idToRef(A)]]))).toBe(same)
  })
})

describe('imagens no e-book', () => {
  it('tira as data URLs do HTML e vira arquivo, sem repetir a mesma imagem', () => {
    const pics = epubImageFiles()
    const png = 'data:image/png;base64,iVBORw0KGgo='
    const html = pics.take(`<p>a</p><figure><img src="${png}" alt=""/></figure><img src="${png}"/>`)
    expect(html).toBe('<p>a</p><figure><img src="imagens/cena-1.png" alt=""/></figure><img src="imagens/cena-1.png"/>')
    expect(Object.keys(pics.files)).toEqual(['OEBPS/imagens/cena-1.png'])
    expect(pics.items).toEqual(['<item id="img1" href="imagens/cena-1.png" media-type="image/png"/>'])
  })
})
