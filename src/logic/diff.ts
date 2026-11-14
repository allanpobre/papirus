import type { Scene } from '../model/schema'

export interface DiffPart {
  kind: 'igual' | 'removido' | 'inserido'
  text: string
}

/**
 * Diferença palavra a palavra entre dois textos (LCS). Mantém espaços e
 * pontuação junto das palavras, para que o resultado possa ser lido como prosa.
 */
export function diffWords(before: string, after: string): DiffPart[] {
  const a = tokenize(before)
  const b = tokenize(after)

  // Corta começo e fim iguais: textos longos costumam mudar pouco.
  let start = 0
  while (start < a.length && start < b.length && a[start] === b[start]) start++
  let endA = a.length
  let endB = b.length
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--
    endB--
  }
  const midA = a.slice(start, endA)
  const midB = b.slice(start, endB)

  const n = midA.length
  const m = midB.length
  // Tabela LCS (n+1 x m+1) em uma única matriz plana.
  const lcs = new Uint32Array((n + 1) * (m + 1))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i * (m + 1) + j] =
        midA[i] === midB[j] ? lcs[(i + 1) * (m + 1) + j + 1] + 1 : Math.max(lcs[(i + 1) * (m + 1) + j], lcs[i * (m + 1) + j + 1])
    }
  }

  const parts: DiffPart[] = []
  const push = (kind: DiffPart['kind'], text: string) => {
    const last = parts[parts.length - 1]
    if (last && last.kind === kind) last.text += text
    else parts.push({ kind, text })
  }

  if (start > 0) push('igual', a.slice(0, start).join(''))
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (midA[i] === midB[j]) {
      push('igual', midA[i])
      i++
      j++
    } else if (lcs[(i + 1) * (m + 1) + j] >= lcs[i * (m + 1) + j + 1]) {
      push('removido', midA[i++])
    } else {
      push('inserido', midB[j++])
    }
  }
  while (i < n) push('removido', midA[i++])
  while (j < m) push('inserido', midB[j++])
  if (endA < a.length) push('igual', a.slice(endA).join(''))
  return parts
}

function tokenize(text: string): string[] {
  return text.match(/\s+|[^\s]+/g) ?? []
}

/** Quantas palavras entraram e saíram. */
export function diffStats(parts: DiffPart[]) {
  const count = (k: DiffPart['kind']) =>
    parts.filter((p) => p.kind === k).reduce((n, p) => n + (p.text.match(/\S+/g)?.length ?? 0), 0)
  return { inserted: count('inserido'), removed: count('removido') }
}

/** Os dois lados do diff: o "antes" (com o que saiu) e o "depois" (com o que entrou), para ver um ao lado do outro. */
export function splitDiff(parts: DiffPart[]): { before: DiffPart[]; after: DiffPart[] } {
  return { before: parts.filter((p) => p.kind !== 'inserido'), after: parts.filter((p) => p.kind !== 'removido') }
}

/** O que se compara com uma versão: o texto atual da cena ('atual') ou outra versão guardada. */
export type CompareTarget = 'atual' | string

export interface SceneComparison {
  /** Nome do lado "antes" e do "depois", para os títulos. */
  fromName: string
  toName: string
  parts: DiffPart[]
  stats: { inserted: number; removed: number }
}

/** Compara duas versões de uma cena, ou uma versão com o texto atual. `null` se a versão não existe. */
export function compareSceneVersions(scene: Scene, fromId: string, to: CompareTarget): SceneComparison | null {
  const from = scene.versions.find((v) => v.id === fromId)
  if (!from) return null
  const other = to === 'atual' ? undefined : scene.versions.find((v) => v.id === to)
  if (to !== 'atual' && !other) return null
  const parts = diffWords(from.text, other ? other.text : scene.text)
  return { fromName: from.name, toName: other ? other.name : 'texto atual', parts, stats: diffStats(parts) }
}
