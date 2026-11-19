import { describe, expect, it } from 'vitest'
import { membershipsOf } from '../model/lists'
import { ostriaUniverse } from '../model/sampleOstria'
import { manuscriptOrder } from '../model/universe'
import { appearancesOf } from './appearances'
import { levelsOf, powerIssues, powerKey, powersAt, templateNodes } from './powers'

describe('poderes: a árvore do sistema e o que o personagem tem em cada ponto', () => {
  const base = ostriaUniverse()
  const order = manuscriptOrder(base)
  const kael = base.entities.find((e) => e.name === 'Kael')!
  const at = (t: string) => order.findIndex((s) => s.title === t)
  const nodes = templateNodes('graus')
  const [g1, g2, g3, despertar] = nodes
  const grupo = membershipsOf(base, kael.id)[0]?.owner
  const sistema = { ...base.entities.find((e) => e.kind !== 'personagem')!, id: 'sis', name: 'Os graus', kind: 'magia', nodes: [...nodes.slice(0, 3), { ...despertar, innate: grupo ? [grupo.id] : [] }] }
  const primeira = appearancesOf(base, kael)[0].scene
  const comPoder = { ...kael, learned: [{ systemId: 'sis', nodeId: g2.id, sceneId: order[at('Duas portas')].id }] }
  const u = {
    ...base,
    entities: [...base.entities.map((e) => (e.id === kael.id ? comPoder : e)), sistema],
    scenes: base.scenes.map((s) => (s.id === primeira.id ? { ...s, text: `${s.text} Ali ele usou o Segundo grau.` } : s)),
  }
  const order2 = manuscriptOrder(u)

  it('os níveis seguem o que cada nó pede', () => {
    expect(levelsOf(nodes).map((l) => l.map((n) => n.name))).toEqual([['Primeiro grau'], ['Segundo grau'], ['Terceiro grau'], ['Despertar']])
    // Um ciclo não trava.
    expect(levelsOf([{ id: 'a', name: 'A', requires: ['b'] }, { id: 'b', name: 'B', requires: ['a'] }]).flat()).toHaveLength(2)
  })

  it('aprende numa cena: antes dela, a árvore está apagada; de nascença, acende desde o começo', () => {
    expect(powersAt(u, comPoder, at('A chegada'), order2).has(powerKey('sis', g2.id))).toBe(false)
    expect(powersAt(u, comPoder, at('Duas portas'), order2).get(powerKey('sis', g2.id))?.how).toBe('aprendeu')
    if (grupo) expect(powersAt(u, comPoder, 0, order2).get(powerKey('sis', despertar.id))?.from?.id).toBe(grupo.id)
    expect(powersAt(u, comPoder, order2.length - 1, order2).has(powerKey('sis', g3.id))).toBe(false)
  })

  it('avisa quando aprende antes do que o poder pede e quando usa antes de aprender', () => {
    const issues = powerIssues(u, comPoder, order2)
    expect(issues.some((i) => i.includes('antes de “Primeiro grau”'))).toBe(true)
    expect(issues.some((i) => i.includes(primeira.title))).toBe(at(primeira.title) < at('Duas portas'))
    expect(powerIssues(u, { ...comPoder, learned: [...comPoder.learned, { systemId: 'sis', nodeId: g1.id, sceneId: null }] }, order2).some((i) => i.includes('Primeiro grau'))).toBe(false)
  })
})
