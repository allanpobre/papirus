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
