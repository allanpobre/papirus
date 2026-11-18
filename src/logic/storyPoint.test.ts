import { describe, expect, it } from 'vitest'
import { ostriaUniverse } from '../model/sampleOstria'
import { manuscriptOrder } from '../model/universe'
import { derivedText } from './derivedFields'
import { knownAt, partsAt, pointIndex, readerTextAt, yearAt } from './storyPoint'

describe('o ponto da história', () => {
  const u = ostriaUniverse()
  const order = manuscriptOrder(u)
  const at = (title: string) => order.findIndex((s) => s.title === title)

  it('a posição é a da cena na ordem de leitura; sem cena (ou cena apagada) é o fim', () => {
    expect(pointIndex(order, order[2].id)).toBe(2)
    expect(pointIndex(order, null)).toBe(order.length - 1)
    expect(pointIndex(order, 'nao-existe')).toBe(order.length - 1)
  })

  it('o ano naquele ponto é o da última cena com data até ali', () => {
    const dated = order.map((s, i) => ({ ...s, date: i === 0 ? { year: 300, day: null } : i === 2 ? { year: 305, day: null } : null }))
    expect(yearAt(dated, 0)).toBe(300)
    expect(yearAt(dated, 1)).toBe(300)
    expect(yearAt(dated, 2)).toBe(305)
    expect(yearAt(dated.map((s) => ({ ...s, date: null })), 3)).toBeNull()
  })

  it('o texto da ficha se divide no que já se sabe, no que é segredo e no que só se revela depois', () => {
    const text = 'Fala pouco. [a partir de "O retrato"]Tem os olhos do príncipe.[/a partir] [segredo]É Vaelor.[/segredo]'
    const antes = partsAt(text, at('O retrato') - 1, order)
    expect(antes.find((p) => p.text.includes('olhos'))).toMatchObject({ future: true, revealTitle: 'O retrato', revealAt: at('O retrato') })
    expect(antes.find((p) => p.text.includes('Vaelor'))).toMatchObject({ secret: true })
    const depois = partsAt(text, at('O retrato'), order)
    expect(depois.find((p) => p.text.includes('olhos'))!.future).toBe(false)
    // O leitor: nunca o segredo; o trecho só a partir da cena.
    expect(readerTextAt(text, at('O retrato') - 1, order)).toBe('Fala pouco.')
    expect(readerTextAt(text, at('O retrato'), order)).toBe('Fala pouco. Tem os olhos do príncipe.')
    // Cena que não existe mais: fica escondido do leitor, por segurança.
    expect(readerTextAt('A [a partir de "Sumiu"]B[/a partir]', order.length - 1, order)).toBe('A')
  })

  it('o leitor só conhece a ficha a partir da primeira cena em que ela aparece', () => {
    const mira = u.entities.find((e) => e.name === 'Mira')!
    const { first } = knownAt(u, order, mira, order.length - 1)
    expect(first).not.toBeNull()
    expect(knownAt(u, order, mira, first!).known).toBe(true)
    if (first! > 0) expect(knownAt(u, order, mira, first! - 1).known).toBe(false)
  })

  it('a idade vazia se calcula no ano do ponto escolhido (e no "agora" da história sem ponto)', () => {
    const kael = { ...u.entities.find((e) => e.name === 'Kael')!, startYear: 340, endYear: null }
    expect(derivedText(u, kael, 'Idade', 350)?.text).toMatch(/^10 anos em/)
    expect(derivedText(u, kael, 'Idade', 359)?.text).toMatch(/^19 anos em/)
    expect(derivedText(u, kael, 'Idade')?.text).toMatch(/^19 anos em/)
  })
})

describe('revelação no "Quem é" (a espécie verdadeira)', () => {
  it('o leitor vê a máscara até a cena da revelação; o caderno do leitor só registra a ligação ali', async () => {
    const { addDefiner, addOption, choose, chosenOf } = await import('./definers')
    const { readerBook } = await import('./reader')
    const { patch } = await import('../model/universe')
    let u = ostriaUniverse()
    const order = manuscriptOrder(u)
    const kael = u.entities.find((e) => e.name === 'Kael')!
    const [u1, d] = addDefiner(u, 'Espécie', ['personagem'])
    let humano: string
    let vanderyu: string
    ;[u, humano] = addOption(u1, d, 'Humano')
    ;[u, vanderyu] = addOption(u, d, 'Vanderyu')
    u = choose(u, kael.id, d, vanderyu)
    const rel = chosenOf(u, kael.id, d)!.relationId
    const at = order.findIndex((s) => s.title === 'O retrato')
    u = patch(u, 'relations', rel, { reveal: { sceneId: order[at].id, maskId: humano } })
    const ord = manuscriptOrder(u)
    const { whoIsAt } = await import('./storyPoint')
    const antes = whoIsAt(u, u.entities.find((e) => e.id === kael.id)!, at - 1, ord)[0]
    expect(antes.option.name).toBe('Vanderyu')
    expect(antes.mask?.name).toBe('Humano')
    expect(antes.reveal).toMatchObject({ at, title: 'O retrato', future: true })
    expect(whoIsAt(u, u.entities.find((e) => e.id === kael.id)!, at, ord)[0].reveal?.future).toBe(false)
    // O caderno do leitor (wiki com limite, link de leitura): a ligação entra na cena da revelação, não antes,
    // mesmo que as duas fichas já tenham aparecido (aqui, a Vanderyu está citada na primeira cena).
    u = patch(u, 'scenes', ord[0].id, { presentIds: [...ord[0].presentIds, vanderyu] })
    const item = readerBook(u).relations.find((r) => r.entityIds.includes(kael.id) && r.entityIds.includes(vanderyu))
    expect(item?.at).toBe(at)
    const semRevelacao = patch(u, 'relations', rel, { reveal: undefined })
    expect(readerBook(semRevelacao).relations.find((r) => r.entityIds.includes(kael.id) && r.entityIds.includes(vanderyu))?.at).toBeLessThan(at)
    // Cena da revelação apagada: o leitor nunca fica sabendo (por segurança).
    const lost = patch(u, 'relations', rel, { reveal: { sceneId: 'sumiu', maskId: humano } })
    expect(readerBook(lost).relations.some((r) => r.entityIds.includes(kael.id) && r.entityIds.includes(vanderyu))).toBe(false)
  })
})

describe('máscara no texto e ficha revelada numa cena', () => {
  it('[até "Cena"] é o que o leitor lê antes; o autor (e a wiki da história toda) fica com a verdade', async () => {
    const { setMask, unmarkReveals, splitReveals } = await import('./reveals')
    const { readerText } = await import('./reader')
    const u = ostriaUniverse()
    const order = manuscriptOrder(u)
    const i = order.findIndex((s) => s.title === 'O retrato')
    const base = `Tem olhos [a partir de "O retrato" #${order[i].id.slice(0, 6)}]cinzentos do príncipe[/a partir].`
    const masked = setMask(base, 0, 'escuros')
    expect(masked).toBe(`Tem olhos [até "O retrato" #${order[i].id.slice(0, 6)}]escuros[/até][a partir de "O retrato" #${order[i].id.slice(0, 6)}]cinzentos do príncipe[/a partir].`)
    // Trocar e tirar a máscara.
    expect(setMask(masked, 0, 'pretos')).toContain('[/até]')
    expect(setMask(masked, 0, 'pretos')).not.toContain('escuros')
    expect(setMask(masked, 0, '')).toBe(base)
    expect(splitReveals(masked).filter((p) => p.until).map((p) => p.text)).toEqual(['escuros'])
    // O leitor: a máscara antes, a verdade depois. A verdade (autor, wiki inteira) não tem a máscara.
    expect(readerText(masked, i - 1, order)).toBe('Tem olhos escuros.')
    expect(readerText(masked, i, order)).toBe('Tem olhos cinzentos do príncipe.')
    expect(readerTextAt(masked, i - 1, order)).toBe('Tem olhos escuros.')
    expect(unmarkReveals(masked)).toBe('Tem olhos cinzentos do príncipe.')
    const parts = partsAt(masked, i - 1, order)
    expect(parts.find((p) => p.text === 'escuros')).toMatchObject({ mask: true, maskActive: true })
    expect(partsAt(masked, i, order).find((p) => p.text === 'escuros')?.maskActive).toBe(false)
  })

  it('a ficha revelada numa cena só entra para o leitor ali, mesmo citada antes; a cena apagada esconde de vez', async () => {
    const { appearances } = await import('./reader')
    const { patch } = await import('../model/universe')
    const { cluesBefore } = await import('./storyPoint')
    let u = ostriaUniverse()
    const order = manuscriptOrder(u)
    const mira = u.entities.find((e) => e.name === 'Mira')!
    const antes = appearances(order, u.entities).first.get(mira.id)!
    const depois = order.length - 1
    u = patch(u, 'entities', mira.id, { reveal: { sceneId: order[depois].id } })
    const ord = manuscriptOrder(u)
    expect(appearances(ord, u.entities).first.get(mira.id)).toBe(depois)
    expect(knownAt(u, ord, mira, depois - 1).known).toBe(false)
    expect(knownAt(u, ord, mira, depois).known).toBe(true)
    expect(appearances(ord, u.entities).inScene.get(ord[antes].id)?.has(mira.id)).toBe(false)
    // Jogo limpo: antes da revelação, a Mira já aparecia em cenas (o leitor tem como desconfiar).
    expect(cluesBefore(u, ord, [mira.id], depois).scenes).toBeGreaterThan(0)
    const sumiu = patch(u, 'entities', mira.id, { reveal: { sceneId: 'nao-existe' } })
    expect(appearances(manuscriptOrder(sumiu), sumiu.entities).first.has(mira.id)).toBe(false)
  })
})
