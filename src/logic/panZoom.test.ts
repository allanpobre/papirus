import { describe, expect, it } from 'vitest'
import { clampView, fitView, openingView, revealBox, stageHeight, zoomAt } from './panZoom'

const area = { width: 340, height: 300, contentW: 700, contentH: 66 }

describe('mover e aproximar', () => {
  it('o desenho que cabe abre inteiro e no meio, sem passar do tamanho natural', () => {
    const v = fitView({ width: 1000, height: 400, contentW: 300, contentH: 100 })
    expect(v.k).toBe(1)
    expect(v.x).toBeCloseTo(350)
    expect(v.y).toBeCloseTo(150)
  })

  it('o desenho largo demais abre no menor tamanho legível, no canto, em vez de encolher até não dar para ler', () => {
    const fit = fitView(area)
    expect(fit.k).toBeLessThan(0.5)
    const open = openingView(area)
    expect(open.k).toBe(0.9)
    expect(open.x).toBe(12)
  })

  it('um desenho que cabe com folga abre inteiro mesmo assim', () => {
    expect(openingView({ width: 400, height: 300, contentW: 360, contentH: 100 }).k).toBeCloseTo(1)
  })

  it('aproximar em volta de um ponto o deixa parado debaixo do dedo', () => {
    const v = { x: 20, y: 10, k: 1 }
    const z = zoomAt(v, 2, 100, 80, 0.3, 4)
    // O ponto do desenho que estava em (100, 80) na tela continua em (100, 80).
    const px = (100 - v.x) / v.k
    const py = (80 - v.y) / v.k
    expect(z.x + z.k * px).toBeCloseTo(100)
    expect(z.y + z.k * py).toBeCloseTo(80)
    expect(z.k).toBe(2)
  })

  it('o zoom fica entre o mínimo e o máximo', () => {
    expect(zoomAt({ x: 0, y: 0, k: 1 }, 100, 0, 0, 0.3, 4).k).toBe(4)
    expect(zoomAt({ x: 0, y: 0, k: 1 }, 0.001, 0, 0, 0.3, 4).k).toBe(0.3)
  })

  it('arrastar não leva o desenho para fora da tela: sempre sobra um pedaço à vista', () => {
    const far = clampView({ x: -5000, y: 5000, k: 1 }, area)
    expect(far.x).toBe(340 - 700 - 48)
    expect(far.y).toBe(300 - 66 + 48)
    // Dentro do limite, não mexe.
    expect(clampView({ x: -100, y: 40, k: 1 }, area)).toEqual({ x: -100, y: 40, k: 1 })
  })

  it('a altura da área acompanha o desenho, entre o mínimo e o máximo', () => {
    // Uma geração (66 de altura): fica baixa, no mínimo.
    expect(stageHeight(340, 700, 66, 500)).toBe(160)
    // Muitas gerações: sobe até o máximo.
    expect(stageHeight(340, 300, 2000, 500)).toBe(500)
  })

  it('revelar uma caixa só mexe o necessário', () => {
    const v = { x: 0, y: 0, k: 1 }
    // Já à vista: não mexe.
    expect(revealBox(v, { x: 20, y: 20, w: 100, h: 40 }, area)).toEqual(v)
    // À direita, fora: puxa o desenho para a esquerda até a caixa caber (com folga).
    const moved = revealBox(v, { x: 500, y: 20, w: 150, h: 40 }, area)
    expect(moved.x).toBe(340 - 16 - 650)
    expect(moved.y).toBe(0)
  })
})
