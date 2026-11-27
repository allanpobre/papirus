import { describe, expect, it } from 'vitest'
import { templateNodes } from '../logic/powers'
import { addList, addMembers } from '../model/lists'
import { ostriaUniverse } from '../model/sampleOstria'
import { manuscriptOrder } from '../model/universe'
import { buildWiki, wikiMarkdown } from './wiki'

describe('wiki: poderes', () => {
  const base = ostriaUniverse()
  const order = manuscriptOrder(base)
  const kael = base.entities.find((e) => e.name === 'Kael')!
  const nodes = templateNodes('graus')
  const [, g2] = nodes
  const sistema = { ...base.entities.find((e) => e.kind !== 'personagem')!, id: 'sis-graus', name: 'Os graus', kind: 'magia', aliases: [], nodes }
  const duasPortas = order.findIndex((s) => s.title === 'Duas portas')
  const u = {
    ...base,
    entities: [...base.entities.map((e) => (e.id === kael.id ? { ...e, learned: [{ systemId: sistema.id, nodeId: g2.id, sceneId: order[duasPortas].id }] } : e)), sistema],
  }

  it('o sistema mostra a árvore por nível, e o personagem o que tem', () => {
    const { html, data } = buildWiki(u, { upTo: null })
    expect(html).toContain('Nível 1')
    expect(html).toContain(g2.name)
    expect(html).toMatch(/Os graus: Segundo grau \(aprendeu\)/)
    const ficha = data.fichas.find((f) => f.nome === 'Kael')!
    expect(ficha.poderes).toContain('Os graus: Segundo grau (aprendeu)')
    expect(data.fichas.find((f) => f.nome === 'Os graus')!.arvore?.length).toBeGreaterThan(1)
    expect(wikiMarkdown(data)).toContain('Os graus: Segundo grau (aprendeu)')
  })

  it('sem spoiler: antes da cena em que aprende, o personagem ainda não tem o poder', () => {
    const { data } = buildWiki(u, { upTo: Math.max(0, duasPortas - 1) })
    expect(data.fichas.find((f) => f.nome === 'Kael')?.poderes ?? []).not.toContain('Os graus: Segundo grau (aprendeu)')
  })

  it('o nome da ficha de onde vem o poder de nascença só sai se ela está na wiki', () => {
    // Kael entra na lista de uma ficha (a "espécie"), e o Despertar é de nascença para quem está nela.
    const dono = base.entities.find((e) => e.id !== kael.id && e.kind !== 'personagem' && e.kind !== 'magia')!
    const [comLista, lista] = addList(u, dono.id, 'Povo')
    const grupo = comLista.entities.find((e) => e.id === dono.id)!
    const [, , , despertar] = nodes
    const comInato = (hidden: boolean) => {
      const membro = addMembers(comLista, dono.id, lista.id, [kael.id])
      return {
        ...membro,
        entities: membro.entities.map((e) => (e.id === sistema.id ? { ...e, nodes: nodes.map((n) => (n.id === despertar.id ? { ...n, innate: [dono.id] } : n)) } : e.id === dono.id ? { ...e, wikiHidden: hidden } : e)),
      }
    }
    const aberto = buildWiki(comInato(false), { upTo: null }).data.fichas.find((f) => f.nome === 'Kael')?.poderes ?? []
    expect(aberto.join(' ')).toContain(`pela ficha ${grupo.name}`)
    const escondido = buildWiki(comInato(true), { upTo: null }).data.fichas.find((f) => f.nome === 'Kael')?.poderes ?? []
    expect(escondido.join(' ')).toContain('de nascença')
    expect(escondido.join(' ')).not.toContain(grupo.name)
  })

  it('ficha escondida da wiki some junto com os poderes dela', () => {
    const hidden = { ...u, entities: u.entities.map((e) => (e.id === sistema.id ? { ...e, wikiHidden: true } : e)) }
    const { data } = buildWiki(hidden, { upTo: null })
    expect(data.fichas.find((f) => f.nome === 'Kael')?.poderes ?? []).toEqual([])
  })
})
