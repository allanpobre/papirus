import { describe, expect, it } from 'vitest'
import { addBlock, changeBlock, defaultOrder, hiddenBlocks, layoutOf, moveBlock, removeBlock, visibleBlocks } from './blocks'

const ficha = (blocks?: { id: string; type: string; hidden?: boolean; text?: string }[]) => ({ kind: 'personagem', blocks })

describe('a ficha como página de blocos', () => {
  it('sem ordem guardada, a ficha antiga vira blocos sozinha (a ordem padrão do tipo)', () => {
    expect(layoutOf(ficha()).map((b) => b.type)).toEqual(defaultOrder('personagem'))
    expect(defaultOrder('faccao').indexOf('listas')).toBeLessThan(defaultOrder('faccao').indexOf('ligacoes'))
  })

  it('subir, descer, tirar e pôr de volta; o de conteúdo sai de vez', () => {
    let e = ficha()
    e = { ...e, blocks: moveBlock(e, 'texto', -1) }
    expect(visibleBlocks(e).map((b) => b.type).slice(0, 3)).toEqual(['quadro', 'texto', 'quem-e'])
    e = { ...e, blocks: removeBlock(e, 'fatos') }
    expect(visibleBlocks(e).some((b) => b.type === 'fatos')).toBe(false)
    expect(hiddenBlocks(e).map((b) => b.type)).toEqual(['fatos'])
    e = { ...e, blocks: addBlock(e, 'fatos') }
    expect(visibleBlocks(e).some((b) => b.type === 'fatos')).toBe(true)
    e = { ...e, blocks: addBlock(e, 'nota', 'texto') }
    const nota = layoutOf(e).find((b) => b.type === 'nota')!
    expect(layoutOf(e)[layoutOf(e).findIndex((b) => b.type === 'texto') + 1].id).toBe(nota.id)
    e = { ...e, blocks: changeBlock(e, nota.id, { title: 'Sonhos', text: 'Sonha com o mar.' }) }
    expect(layoutOf(e).find((b) => b.id === nota.id)).toMatchObject({ title: 'Sonhos', text: 'Sonha com o mar.' })
    e = { ...e, blocks: removeBlock(e, nota.id) }
    expect(layoutOf(e).some((b) => b.id === nota.id)).toBe(false)
    // Nas pontas, não sai do lugar.
    expect(moveBlock(e, 'quadro', -1)).toEqual(layoutOf(e))
  })

  it('bloco novo desta versão entra no fim; tipo desconhecido (de outra versão) é ignorado; repetido conta uma vez', () => {
    const e = ficha([
      { id: 'texto', type: 'texto' },
      { id: 'x', type: 'bloco-do-futuro' },
      { id: 'texto2', type: 'texto' },
      { id: 'quadro', type: 'quadro' },
    ])
    const types = layoutOf(e).map((b) => b.type)
    expect(types.slice(0, 2)).toEqual(['texto', 'quadro'])
    expect(types).not.toContain('bloco-do-futuro')
    expect(types.filter((t) => t === 'texto')).toHaveLength(1)
    expect(new Set(types)).toEqual(new Set(defaultOrder('personagem')))
  })
})
