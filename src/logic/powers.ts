import { membershipsOf } from '../model/lists'
import type { Entity, Scene, Universe } from '../model/schema'
import { newId, sceneTitle } from '../model/universe'
import { appearancesOf } from './appearances'
import { relationRevealAt } from './storyPoint'
import { fold } from './text'

/*
 * Poderes e magia. Cada mundo monta o seu sistema numa ficha de "Sistema de magia": uma árvore de nós, cada um
 * pedindo outros antes (todos eles; "dois poderes" são dois pedidos), com custo ou condição e, se for o caso,
 * de nascença para quem é de uma ficha (uma espécie, uma linhagem). O personagem aprende um nó numa cena; a
 * árvore dele acende conforme a régua da história.
 */

export type PowerNode = NonNullable<Entity['nodes']>[number]
export type Learned = NonNullable<Entity['learned']>[number]

/** Quem pode ter poderes (o bloco aparece no "+ Bloco" destes tipos, e nos tipos próprios do autor). */
export const canHavePowers = (kind: string) => !['magia', 'lugar', 'reino', 'conceito', 'documento', 'religiao'].includes(kind)

/** As fichas que têm árvore de poderes. */
export const systemsOf = (u: Universe): Entity[] => u.entities.filter((e) => (e.nodes?.length ?? 0) > 0)

/** Os níveis da árvore: quem não pede nada fica no 1; os outros, um depois do que pedem (sem travar num ciclo). */
export function levelsOf(nodes: PowerNode[]): PowerNode[][] {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const depth = new Map<string, number>()
  const walk = (n: PowerNode, seen: Set<string>): number => {
    if (depth.has(n.id)) return depth.get(n.id)!
    if (seen.has(n.id)) return 0
    seen.add(n.id)
    const reqs = n.requires.map((id) => byId.get(id)).filter((x): x is PowerNode => !!x)
    const d = reqs.length ? 1 + Math.max(...reqs.map((r) => walk(r, seen))) : 0
    depth.set(n.id, d)
    return d
  }
  for (const n of nodes) walk(n, new Set())
  const out: PowerNode[][] = []
  for (const n of nodes) (out[depth.get(n.id)!] ??= []).push(n)
  return out.filter(Boolean)
}

export interface PowerHad {
  /** De nascença (pela ficha de onde vem) ou aprendido (na cena `at`, ou -1: desde o começo). */
  how: 'nasceu' | 'aprendeu'
  at: number
  from?: Entity
}

/**
 * O que a ficha tem de cada sistema até o ponto `index` da história. Como o leitor, o que vem de nascença por
 * uma ligação que ele ainda não descobriu (a espécie verdadeira) fica de fora.
 */
export function powersAt(u: Universe, e: Entity, index: number, scenes: Scene[], reader = false): Map<string, PowerHad> {
  const out = new Map<string, PowerHad>()
  const key = (systemId: string, nodeId: string) => `${systemId}:${nodeId}`
  const memberships = membershipsOf(u, e.id).filter(({ relation }) => !(reader && relationRevealAt(relation, index, scenes)?.future))
  const owners = new Map(memberships.map(({ owner }) => [owner.id, owner]))
  owners.set(e.id, e)
  for (const sys of systemsOf(u))
    for (const n of sys.nodes ?? []) {
      const src = (n.innate ?? []).map((id) => owners.get(id)).find(Boolean)
      if (src) out.set(key(sys.id, n.id), { how: 'nasceu', at: -1, from: src })
    }
  for (const l of e.learned ?? []) {
    const at = l.sceneId ? scenes.findIndex((s) => s.id === l.sceneId) : -1
    if (l.sceneId && at < 0) continue
    if (at > index) continue
    if (!out.has(key(l.systemId, l.nodeId))) out.set(key(l.systemId, l.nodeId), { how: 'aprendeu', at })
  }
  return out
}

export const powerKey = (systemId: string, nodeId: string) => `${systemId}:${nodeId}`

/**
 * O que não fecha: aprender um poder antes do que ele pede, e usar um poder (o nome dele numa cena em que a
 * ficha aparece) antes da cena em que aprende.
 */
export function powerIssues(u: Universe, e: Entity, scenes: Scene[]): string[] {
  const issues: string[] = []
  const systems = new Map(systemsOf(u).map((s) => [s.id, s]))
  const all = powersAt(u, e, scenes.length - 1, scenes)
  const seenIn = appearancesOf(u, e).map((a) => scenes.findIndex((s) => s.id === a.scene.id))
  for (const l of e.learned ?? []) {
    const sys = systems.get(l.systemId)
    const node = sys?.nodes?.find((n) => n.id === l.nodeId)
    if (!sys || !node) continue
    const at = l.sceneId ? scenes.findIndex((s) => s.id === l.sceneId) : -1
    for (const reqId of node.requires) {
      const req = sys.nodes?.find((n) => n.id === reqId)
      const had = all.get(powerKey(sys.id, reqId))
      if (req && (!had || had.at > at)) issues.push(`Aprende “${node.name}” antes de “${req.name}”, que ele pede.`)
    }
    if (at > 0 && node.name.trim().length >= 3) {
      const word = new RegExp(`(^|[^\\p{L}])${fold(node.name.trim()).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\p{L}]|$)`, 'u')
      const early = seenIn.filter((j) => j >= 0 && j < at).find((j) => word.test(fold(scenes[j].text)))
      if (early !== undefined) issues.push(`“${node.name}” aparece em “${sceneTitle(scenes[early])}”, antes de ${e.name || 'esta ficha'} aprender (em “${sceneTitle(scenes[at])}”).`)
    }
  }
  return issues
}

/** Modelos prontos para começar um sistema (todos editáveis depois). */
export const POWER_TEMPLATES: { id: string; label: string; hint: string; nodes: [string, string[], string?][] }[] = [
  {
    id: 'escolas',
    label: 'Escolas',
    hint: 'Ramos de estudo, do básico ao mestre.',
    nodes: [
      ['Destruição', []],
      ['Restauração', []],
      ['Ilusão', []],
      ['Mestre da destruição', ['Destruição']],
      ['Cura maior', ['Restauração']],
    ],
  },
  {
    id: 'elementos',
    label: 'Elementos',
    hint: 'Cada um domina um elemento; a combinação é rara.',
    nodes: [
      ['Água', []],
      ['Terra', []],
      ['Fogo', []],
      ['Ar', []],
      ['Vapor', ['Água', 'Fogo']],
    ],
  },
  {
    id: 'graus',
    label: 'Graus',
    hint: 'Um caminho em degraus, como num shōnen.',
    nodes: [
      ['Primeiro grau', []],
      ['Segundo grau', ['Primeiro grau']],
      ['Terceiro grau', ['Segundo grau']],
      ['Despertar', ['Terceiro grau'], 'Só uma vez na vida'],
    ],
  },
  {
    id: 'pactos',
    label: 'Pactos',
    hint: 'Poder em troca de um preço.',
    nodes: [
      ['Pacto', [], 'Um juramento'],
      ['Visão', ['Pacto'], 'Um ano de vida'],
      ['Chamado', ['Pacto'], 'Um nome verdadeiro'],
    ],
  },
  {
    id: 'oficios',
    label: 'Ofícios',
    hint: 'Mundo sem magia: o que se aprende com as mãos.',
    nodes: [
      ['Aprendiz', []],
      ['Oficial', ['Aprendiz']],
      ['Mestre', ['Oficial'], 'Uma obra-prima'],
    ],
  },
]

/** Os nós de um modelo, com os pedidos ligados pelos ids novos. */
export function templateNodes(id: string): PowerNode[] {
  const t = POWER_TEMPLATES.find((x) => x.id === id)
  if (!t) return []
  const ids = new Map(t.nodes.map(([name]) => [name, newId()]))
  return t.nodes.map(([name, reqs, cost]) => ({ id: ids.get(name)!, name, requires: reqs.map((r) => ids.get(r)!), ...(cost ? { cost } : {}) }))
}
