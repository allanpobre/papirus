import type { SceneDoc } from '../model/schema'

interface DocNode {
  type: string
  marks?: { type: string; attrs?: Record<string, unknown> }[]
  content?: DocNode[]
}

/** IDs das fichas ligadas por menções confirmadas no documento da cena. */
export function mentionIdsInDoc(doc: SceneDoc): Set<string> {
  const ids = new Set<string>()
  const walk = (n: DocNode) => {
    for (const m of n.marks ?? []) {
      if (m.type === 'mention' && typeof m.attrs?.entityId === 'string') ids.add(m.attrs.entityId)
    }
    n.content?.forEach(walk)
  }
  walk(doc as DocNode)
  return ids
}

/** Um parágrafo é fala se começa com travessão, aspas ou meia-risca. */
export const isDialogue = (paragraph: string) => /^\s*[—–\-"“«]/.test(paragraph)
