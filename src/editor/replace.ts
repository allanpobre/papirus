import { getSchema, getText, getTextSerializersFromSchema } from '@tiptap/core'
import { Node as PMNode } from '@tiptap/pm/model'
import { Transform } from '@tiptap/pm/transform'
import type { SceneDoc, Universe } from '../model/schema'
import { manuscriptOrder } from '../model/universe'
import { baseExtensions } from './extensions'
import { findInDoc, findRanges, followCase, searchPattern, type FindOptions } from './find'

export { findInDoc, findRanges, followCase, searchPattern, type FindOptions } from './find'

/** Um achado no livro: em qual cena, se no título ou no texto, e o trecho em volta para conferir. */
export interface Hit {
  /** Identifica o achado para marcar e desmarcar (cena, lugar e ordem dentro dele). */
  key: string
  sceneId: string
  where: 'titulo' | 'texto'
  before: string
  match: string
  after: string
}

let cachedSchema: ReturnType<typeof getSchema> | null = null
const schema = () => (cachedSchema ??= getSchema(baseExtensions))

/** O texto da cena do jeito que o editor guarda (parágrafos separados por linha em branco). */
export function plainText(doc: PMNode): string {
  return getText(doc, { blockSeparator: '\n\n', textSerializers: getTextSerializersFromSchema(schema()) })
}

const CONTEXT = 48

function around(text: string, from: number, to: number) {
  const start = Math.max(0, from - CONTEXT)
  const end = Math.min(text.length, to + CONTEXT)
  // Corta no espaço, para não começar no meio de uma palavra.
  let before = text.slice(start, from)
  let after = text.slice(to, end)
  if (start > 0) before = `…${before.replace(/^\S*\s/, '')}`
  if (end < text.length) after = `${after.replace(/\s\S*$/, '')}…`
  return { before, after }
}

/** Tudo o que a busca acha no livro: títulos e textos das cenas, na ordem do manuscrito. */
export function findInBook(u: Universe, query: string, opts: FindOptions): Hit[] {
  const hits: Hit[] = []
  if (!query) return hits
  for (const scene of manuscriptOrder(u)) {
    findRanges(scene.title, query, opts).forEach((r, i) => hits.push({ key: `${scene.id}:titulo:${i}`, sceneId: scene.id, where: 'titulo', match: scene.title.slice(r.from, r.to), ...around(scene.title, r.from, r.to) }))
    // Busca primeiro no texto simples (rápido); só lê o documento quando há chance de achar.
    if (!searchPattern(query, opts)!.test(scene.text)) continue
    const doc = PMNode.fromJSON(schema(), scene.doc)
    findInDoc(doc, query, opts).forEach((h, i) => hits.push({ key: `${scene.id}:texto:${i}`, sceneId: scene.id, where: 'texto', match: h.block.slice(h.at, h.at + (h.to - h.from)), ...around(h.block, h.at, h.at + (h.to - h.from)) }))
  }
  return hits
}

/** Troca no documento os achados escolhidos, sem perder negrito, itálico, menções e comentários. */
export function replaceInDoc(doc: SceneDoc, query: string, replacement: string, opts: FindOptions, keep: (index: number) => boolean = () => true): { doc: SceneDoc; text: string; count: number } | null {
  const node = PMNode.fromJSON(schema(), doc)
  const hits = findInDoc(node, query, opts)
    .map((h, i) => ({ ...h, i }))
    .filter((h) => keep(h.i))
  if (!hits.length) return null
  const tr = new Transform(node)
  // De trás para frente: as posições de antes continuam valendo.
  for (const h of [...hits].reverse()) {
    const found = node.textBetween(h.from, h.to)
    const text = followCase(found, replacement, opts)
    if (!text) tr.delete(h.from, h.to)
    else tr.replaceWith(h.from, h.to, schema().text(text, node.nodeAt(h.from)?.marks ?? []))
  }
  return { doc: tr.doc.toJSON() as SceneDoc, text: plainText(tr.doc), count: hits.length }
}

/** Troca num texto simples (título da cena). */
export function replaceInText(text: string, query: string, replacement: string, opts: FindOptions, keep: (index: number) => boolean = () => true) {
  const ranges = findRanges(text, query, opts)
  let out = text
  let count = 0
  for (let i = ranges.length - 1; i >= 0; i--) {
    if (!keep(i)) continue
    const r = ranges[i]
    out = out.slice(0, r.from) + followCase(text.slice(r.from, r.to), replacement, opts) + out.slice(r.to)
    count++
  }
  return { text: out, count }
}

/**
 * Troca no livro só os achados marcados (`chosen`, pelas chaves de `findInBook`).
 * Devolve o universo novo e quantas trocas foram feitas. Fichas e o resto do universo não mudam.
 */
export function replaceInBook(u: Universe, query: string, replacement: string, opts: FindOptions, chosen: Set<string>): { universe: Universe; count: number; sceneIds: string[] } {
  let count = 0
  const sceneIds: string[] = []
  const stamp = new Date().toISOString()
  const scenes = u.scenes.map((scene) => {
    let changed = scene
    const title = replaceInText(scene.title, query, replacement, opts, (i) => chosen.has(`${scene.id}:titulo:${i}`))
    if (title.count) {
      changed = { ...changed, title: title.text }
      count += title.count
    }
    if ([...chosen].some((k) => k.startsWith(`${scene.id}:texto:`))) {
      const body = replaceInDoc(scene.doc, query, replacement, opts, (i) => chosen.has(`${scene.id}:texto:${i}`))
      if (body) {
        changed = { ...changed, doc: body.doc, text: body.text }
        count += body.count
      }
    }
    if (changed === scene) return scene
    sceneIds.push(scene.id)
    return { ...changed, updatedAt: stamp }
  })
  return count ? { universe: { ...u, scenes, updatedAt: stamp }, count, sceneIds } : { universe: u, count: 0, sceneIds }
}
