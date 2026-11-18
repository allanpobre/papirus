import type { Entity } from './schema'
import { newId } from './universe'

/*
 * A ficha como página de blocos. Os blocos de dados são janelas para o que já está na ficha (tirar um da página
 * não apaga nada); os de conteúdo (nota, citação, galeria) guardam o que têm. Sem ordem escolhida, a ficha usa a
 * ordem padrão do tipo: a ficha antiga vira blocos sozinha, sem mudar nada guardado.
 */

export type Block = NonNullable<Entity['blocks']>[number]

/** Os blocos de dados (um de cada, sempre existem) e os de conteúdo (quantos quiser). */
export const DATA_BLOCKS = ['quadro', 'quem-e', 'texto', 'listas', 'ligacoes', 'fatos', 'sabe', 'fases', 'tempo', 'pistas', 'referencias', 'aparece'] as const
export const CONTENT_BLOCKS = ['nota', 'citacao', 'galeria'] as const
export type DataBlock = (typeof DATA_BLOCKS)[number]
export type ContentBlock = (typeof CONTENT_BLOCKS)[number]
export type BlockType = DataBlock | ContentBlock

export const BLOCK_LABEL: Record<BlockType, string> = {
  quadro: 'Quadro (retrato e campos)',
  'quem-e': 'Quem é',
  texto: 'Texto',
  listas: 'Listas',
  ligacoes: 'Ligações',
  fatos: 'Fatos',
  sabe: 'O que sabe',
  fases: 'Ao longo da história',
  tempo: 'Linha do tempo',
  pistas: 'Pistas e mistérios',
  referencias: 'Referências',
  aparece: 'Aparece em',
  nota: 'Nota',
  citacao: 'Citação de uma cena',
  galeria: 'Galeria de imagens',
}

const isData = (t: string): t is DataBlock => (DATA_BLOCKS as readonly string[]).includes(t)
const isContent = (t: string): t is ContentBlock => (CONTENT_BLOCKS as readonly string[]).includes(t)

/** A ordem padrão de cada tipo de ficha (o que mais importa primeiro). */
export function defaultOrder(kind: string): DataBlock[] {
  const lugar = kind === 'lugar' || kind === 'reino'
  const grupo = kind === 'faccao' || kind === 'cultura' || kind === 'religiao' || kind === 'especie'
  if (lugar || grupo) return ['quadro', 'quem-e', 'texto', 'listas', 'ligacoes', 'fatos', 'tempo', 'fases', 'pistas', 'referencias', 'sabe', 'aparece']
  return ['quadro', 'quem-e', 'texto', 'ligacoes', 'listas', 'fatos', 'sabe', 'fases', 'tempo', 'pistas', 'referencias', 'aparece']
}

/**
 * A página da ficha: os blocos na ordem escolhida (ou a padrão). Um bloco de dados que não está na ordem guardada
 * (porque é novo nesta versão) entra no fim; um tipo desconhecido (de outra versão) é ignorado, sem quebrar.
 */
export function layoutOf(e: Pick<Entity, 'kind' | 'blocks'>): Block[] {
  const saved = (e.blocks ?? []).filter((b) => isData(b.type) || isContent(b.type))
  if (!saved.length) return defaultOrder(e.kind).map((type) => ({ id: type, type }))
  const seen = new Set<string>()
  const out: Block[] = []
  for (const b of saved) {
    if (isData(b.type)) {
      if (seen.has(b.type)) continue
      seen.add(b.type)
    }
    out.push(b)
  }
  for (const type of defaultOrder(e.kind)) if (!seen.has(type)) out.push({ id: type, type })
  return out
}

/** Os blocos que aparecem na página (sem os tirados). */
export const visibleBlocks = (e: Pick<Entity, 'kind' | 'blocks'>) => layoutOf(e).filter((b) => !b.hidden)

/** Os blocos de dados que foram tirados (para pôr de volta). */
export const hiddenBlocks = (e: Pick<Entity, 'kind' | 'blocks'>) => layoutOf(e).filter((b) => b.hidden)

/** Sobe ou desce um bloco entre os visíveis. Devolve a nova ordem (para guardar em `blocks`). */
export function moveBlock(e: Pick<Entity, 'kind' | 'blocks'>, id: string, step: -1 | 1): Block[] {
  const all = layoutOf(e)
  const visible = all.filter((b) => !b.hidden)
  const i = visible.findIndex((b) => b.id === id)
  const j = i + step
  if (i < 0 || j < 0 || j >= visible.length) return all
  const a = all.indexOf(visible[i])
  const b = all.indexOf(visible[j])
  const next = [...all]
  ;[next[a], next[b]] = [next[b], next[a]]
  return next
}

/** Tira um bloco da página: o de dados fica escondido (os dados ficam na ficha); o de conteúdo sai de vez. */
export function removeBlock(e: Pick<Entity, 'kind' | 'blocks'>, id: string): Block[] {
  return layoutOf(e).flatMap((b) => (b.id !== id ? [b] : isData(b.type) ? [{ ...b, hidden: true }] : []))
}

/** Põe um bloco na página: um de dados que estava tirado volta; um de conteúdo novo entra depois de `after`. */
export function addBlock(e: Pick<Entity, 'kind' | 'blocks'>, type: BlockType, after?: string): Block[] {
  const all = layoutOf(e)
  if (isData(type)) return all.map((b) => (b.type === type ? { ...b, hidden: undefined } : b))
  const block: Block = { id: newId(), type, ...(type === 'galeria' ? { images: [] } : { text: '' }) }
  const at = after ? all.findIndex((b) => b.id === after) : -1
  return at < 0 ? [...all, block] : [...all.slice(0, at + 1), block, ...all.slice(at + 1)]
}

/** Muda o conteúdo de um bloco (nota, citação, galeria). */
export const changeBlock = (e: Pick<Entity, 'kind' | 'blocks'>, id: string, changes: Partial<Block>): Block[] => layoutOf(e).map((b) => (b.id === id ? { ...b, ...changes } : b))
