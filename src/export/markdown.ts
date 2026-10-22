import { scenesOf } from '../model/universe'
import type { Scene, SceneDoc, Universe } from '../model/schema'

/** Nó do documento do editor, na forma em que é salvo. */
interface DocNode {
  type: string
  text?: string
  attrs?: Record<string, unknown>
  marks?: { type: string }[]
  content?: DocNode[]
}

/** Marcas exportadas, na ordem em que são abertas. */
const MARKS: Record<string, string> = { bold: '**', italic: '*', strike: '~~' }
const MARK_ORDER = Object.keys(MARKS)

/** Separador de cena usado no Markdown exportado. */
export const SCENE_BREAK = '* * *'

export function docToMarkdown(doc: SceneDoc): string {
  return renderBlocks((doc as DocNode).content ?? [])
}

export function sceneToMarkdown(scene: Scene, headingLevel = 1): string {
  const heading = `${'#'.repeat(headingLevel)} ${escapeInline(scene.title || 'Sem título')}`
  const body = docToMarkdown(scene.doc)
  return body ? `${heading}\n\n${body}\n` : `${heading}\n`
}

/** Exporta todas as histórias, em ordem, seguidas das cenas soltas. */
export function universeToMarkdown(universe: Universe): string {
  const parts: string[] = [`# ${escapeInline(universe.name || 'Universo')}`]
  for (const story of universe.stories) {
    parts.push(`## ${escapeInline(story.title || 'Sem título')}`)
    for (const scene of scenesOf(universe, story.id)) parts.push(sceneToMarkdown(scene, 3).trimEnd())
  }
  const loose = scenesOf(universe, null)
  if (loose.length) {
    parts.push('## Cenas soltas')
    for (const scene of loose) parts.push(sceneToMarkdown(scene, 3).trimEnd())
  }
  return parts.join('\n\n') + '\n'
}

function renderBlocks(nodes: DocNode[], separator = '\n\n'): string {
  return nodes
    .map(renderBlock)
    .filter((s) => s !== '')
    .join(separator)
}

function renderBlock(node: DocNode): string {
  switch (node.type) {
    case 'paragraph':
      return escapeLineStart(renderInline(node.content ?? []))
    case 'horizontalRule':
      return SCENE_BREAK
    case 'blockquote':
      return prefixLines(renderBlocks(node.content ?? []), '> ', '>')
    case 'bulletList':
      return renderList(node, () => '- ')
    case 'orderedList': {
      const start = typeof node.attrs?.start === 'number' ? node.attrs.start : 1
      return renderList(node, (i) => `${start + i}. `)
    }
    default:
      // Tipo desconhecido: preserva ao menos o texto.
      return node.content ? renderBlocks(node.content) : escapeInline(node.text ?? '')
  }
}

function renderList(node: DocNode, marker: (index: number) => string): string {
  return (node.content ?? [])
    .map((item, i) => {
      const m = marker(i)
      const body = renderBlocks(item.content ?? [])
      const indent = ' '.repeat(m.length)
      return body
        .split('\n')
        .map((line, j) => (j === 0 ? m + line : line ? indent + line : line))
        .join('\n')
    })
    .join('\n')
}

function renderInline(nodes: DocNode[]): string {
  let out = ''
  let open: string[] = []

  // Fecha marcas antes de qualquer espaço final, pois `**texto **` não é ênfase válida.
  const closeTo = (keep: number) => {
    const trailing = out.match(/\s*$/)![0]
    out = out.slice(0, out.length - trailing.length)
    for (let i = open.length - 1; i >= keep; i--) out += MARKS[open[i]]
    out += trailing
    open = open.slice(0, keep)
  }

  for (const node of nodes) {
    if (node.type === 'hardBreak') {
      closeTo(0)
      out += '\\\n'
      continue
    }
    const text = node.text ?? ''
    const [, lead, core, trail] = text.match(/^(\s*)(.*?)(\s*)$/s)!
    if (!core) {
      out += text
      continue
    }

    const names = new Set((node.marks ?? []).map((m) => m.type))
    const wanted = MARK_ORDER.filter((m) => names.has(m))
    let common = 0
    while (common < open.length && open[common] === wanted[common]) common++

    closeTo(common)
    out += lead
    for (const m of wanted.slice(common)) out += MARKS[m]
    open = wanted
    out += escapeInline(core) + trail
  }
  closeTo(0)
  return out
}

function escapeInline(text: string): string {
  return text.replace(/[\\`*_~[\]]/g, '\\$&')
}

/** Escapa o que, no início de uma linha, seria lido como título, citação ou lista. */
function escapeLineStart(text: string): string {
  return text
    .split('\n')
    .map((line) =>
      line
        .replace(/^(\s*)(>|(?:#{1,6}|[+-])(?=\s|$))/, '$1\\$2')
        .replace(/^(\s*)(\d+)([.)])(?=\s|$)/, '$1$2\\$3'),
    )
    .join('\n')
}

function prefixLines(text: string, prefix: string, emptyPrefix: string): string {
  return text
    .split('\n')
    .map((line) => (line ? prefix + line : emptyPrefix))
    .join('\n')
}
