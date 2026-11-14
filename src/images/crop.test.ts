import { describe, expect, it } from 'vitest'
import { isWhole, MIN_CROP, moveRect, pixelRect, resizeRect, squareRect, wholeRect } from './crop'

describe('recortar a imagem', () => {
  it('o quadrado do retrato: zoom 1 é o maior quadrado, e o zoom o encolhe sem sair da imagem', () => {
    // Foto horizontal 400 × 200: o maior quadrado tem 200 de lado.
    expect(squareRect(400, 200, 1, 200, 100)).toEqual({ x: 100, y: 0, w: 200, h: 200 })
    expect(squareRect(400, 200, 2, 200, 100)).toEqual({ x: 150, y: 50, w: 100, h: 100 })
    // Foto vertical.
    expect(squareRect(200, 400, 1, 100, 200)).toEqual({ x: 0, y: 100, w: 200, h: 200 })
  })

  it('o centro é puxado para dentro da imagem (não dá para arrastar para fora)', () => {
    expect(squareRect(400, 200, 1, 0, 100).x).toBe(0)
    expect(squareRect(400, 200, 1, 9999, 100).x).toBe(200)
    expect(squareRect(400, 200, 2, 0, 0)).toEqual({ x: 0, y: 0, w: 100, h: 100 })
    expect(squareRect(400, 200, 2, 9999, 9999)).toEqual({ x: 300, y: 100, w: 100, h: 100 })
  })

  it('zoom menor que 1 vale 1 e zoom enorme não passa do tamanho mínimo', () => {
    expect(squareRect(400, 200, 0.2, 200, 100).w).toBe(200)
    expect(squareRect(400, 200, 1000, 200, 100).w).toBe(MIN_CROP)
    // Imagem pequenininha: o mínimo é o lado dela.
    expect(squareRect(20, 20, 4, 10, 10).w).toBe(20)
  })

  it('mover o recorte livre não deixa sair da imagem', () => {
    const r = { x: 50, y: 50, w: 100, h: 80 }
    expect(moveRect(r, 20, -10, 400, 300)).toEqual({ x: 70, y: 40, w: 100, h: 80 })
    expect(moveRect(r, -999, -999, 400, 300)).toEqual({ x: 0, y: 0, w: 100, h: 80 })
    expect(moveRect(r, 999, 999, 400, 300)).toEqual({ x: 300, y: 220, w: 100, h: 80 })
  })

  it('arrastar bordas e cantos redimensiona, respeitando a imagem e o tamanho mínimo', () => {
    const r = { x: 100, y: 100, w: 100, h: 100 }
    expect(resizeRect(r, 'e', 50, 0, 400, 300)).toEqual({ x: 100, y: 100, w: 150, h: 100 })
    expect(resizeRect(r, 'w', -40, 0, 400, 300)).toEqual({ x: 60, y: 100, w: 140, h: 100 })
    expect(resizeRect(r, 'se', 30, 20, 400, 300)).toEqual({ x: 100, y: 100, w: 130, h: 120 })
    expect(resizeRect(r, 'nw', -30, -20, 400, 300)).toEqual({ x: 70, y: 80, w: 130, h: 120 })
    // Não passa das bordas da imagem...
    expect(resizeRect(r, 'se', 9999, 9999, 400, 300)).toEqual({ x: 100, y: 100, w: 300, h: 200 })
    expect(resizeRect(r, 'nw', -9999, -9999, 400, 300)).toEqual({ x: 0, y: 0, w: 200, h: 200 })
    // ...nem fica menor que o mínimo, e a borda oposta não se mexe.
    expect(resizeRect(r, 'e', -9999, 0, 400, 300)).toEqual({ x: 100, y: 100, w: MIN_CROP, h: 100 })
    expect(resizeRect(r, 'n', 0, 9999, 400, 300)).toEqual({ x: 100, y: 200 - MIN_CROP, w: 100, h: MIN_CROP })
  })

  it('o recorte vira pixels inteiros dentro da imagem, e a imagem inteira é reconhecida', () => {
    expect(pixelRect({ x: 10.6, y: 3.2, w: 99.5, h: 50.4 }, 400, 300)).toEqual({ x: 11, y: 3, w: 100, h: 50 })
    expect(pixelRect({ x: 390, y: 290, w: 100, h: 100 }, 400, 300)).toEqual({ x: 390, y: 290, w: 10, h: 10 })
    expect(isWhole(wholeRect(400, 300), 400, 300)).toBe(true)
    expect(isWhole({ x: 0, y: 0, w: 399.4, h: 300 }, 400, 300)).toBe(false)
    expect(isWhole({ x: 1, y: 0, w: 400, h: 300 }, 400, 300)).toBe(false)
  })
})
