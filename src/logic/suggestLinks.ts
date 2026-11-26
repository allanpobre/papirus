import type { Universe } from '../model/schema'

/*
 * Ligações escritas no texto (auditoria 26, Duda): quem traz notas do Obsidian já escreveu “Irmão de [[Mira]]” ou
 * “serve à [[Casa Vaelor]]”. Aqui achamos essas frases nas fichas (resumo, descrição e campos) e PROPOMOS a ligação,
 * para o autor aceitar ou não. Nada vira ligação sozinho, e o tipo é a palavra que o próprio autor escreveu.
 */

export interface SuggestedLink {
  fromId: string
  toId: string
  /** O tipo como o texto diz, em minúsculas: “irmão de”, “serve a”, “nasceu em”. */
  type: string
  /** O trecho de onde veio, para o autor conferir. */
  quote: string
}

// Parentesco e afins: “<palavra> de/da/do/dos/das <Nome>”. Guardamos a palavra e usamos “de” no tipo.
const KIN = [
  'irmão', 'irmã', 'pai', 'mãe', 'filho', 'filha', 'tio', 'tia', 'primo', 'prima', 'avô', 'avó', 'neto', 'neta',
  'marido', 'esposa', 'esposo', 'noiva', 'noivo', 'amigo', 'amiga', 'inimigo', 'inimiga', 'rival', 'aliado', 'aliada',
  'mestre', 'mestra', 'aprendiz', 'discípulo', 'discípula', 'servo', 'serva', 'criado', 'criada', 'guarda', 'líder',
  'chefe', 'membro', 'rei', 'rainha', 'príncipe', 'princesa', 'herdeiro', 'herdeira', 'capitão', 'capitã', 'criador',
  'criadora', 'dono', 'dona', 'capital', 'parte', 'filial',
]
// Verbos: “<verbo> [a/à/ao/em/no/na…] <Nome>”, com o tipo no infinitivo-presente como o texto diz.
const VERBS: [RegExp, string][] = [
  [/\bserve(?:m)?\s+(?:a|à|ao|aos|às)\s+$/i, 'serve a'],
  [/\bgoverna(?:m)?\s+(?:o|a|os|as)?\s*$/i, 'governa'],
  [/\blidera(?:m)?\s+(?:o|a|os|as)?\s*$/i, 'lidera'],
  [/\bnasceu\s+(?:em|no|na|nos|nas)\s+$/i, 'nasceu em'],
  [/\b(?:vive|mora)(?:m)?\s+(?:em|no|na|nos|nas)\s+$/i, 'vive em'],
  [/\bfica\s+(?:em|no|na|nos|nas)\s+$/i, 'fica em'],
  [/\bpertence(?:m)?\s+(?:a|à|ao|aos|às)\s+$/i, 'pertence a'],
  [/\b(?:odeia|ama|protege|persegue|traiu|teme)\s+(?:o|a|os|as)?\s*$/i, ''],
]
const KIN_RE = new RegExp(`\\b(${KIN.join('|')})\\s+(?:de|da|do|dos|das)\\s+$`, 'i')

const textOf = (e: Universe['entities'][number]) => [e.summary, e.description, ...e.fields.map((f) => f.value)].filter(Boolean).join('\n')

export function suggestLinks(u: Universe): SuggestedLink[] {
  const names = u.entities.flatMap((e) => [e.name, ...(e.aliases ?? [])].filter((n) => n.trim().length >= 2).map((n) => ({ id: e.id, name: n.trim() })))
  // Nomes compridos primeiro: “Casa Vaelor” antes de “Vaelor”.
  names.sort((a, b) => b.name.length - a.name.length)
  const linked = new Set(u.relations.flatMap((r) => [`${r.fromId}>${r.toId}`, `${r.toId}>${r.fromId}`]))
  const out: SuggestedLink[] = []
  const seen = new Set<string>()
  for (const e of u.entities) {
    if (e.canon === 'secreto') continue
    const text = textOf(e)
    if (!text) continue
    for (const { id, name } of names) {
      if (id === e.id) continue
      const pair = `${e.id}>${id}`
      if (linked.has(pair) || seen.has(pair) || seen.has(`${id}>${e.id}`)) continue
      const re = new RegExp(`(^|[^\\p{L}])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}])`, 'giu')
      for (const m of text.matchAll(re)) {
        const at = (m.index ?? 0) + m[1].length
        const before = text.slice(Math.max(0, at - 40), at)
        let type = ''
        const kin = before.match(KIN_RE)
        if (kin) type = `${kin[1].toLowerCase()} de`
        else for (const [re2, t] of VERBS) {
          const v = before.match(re2)
          if (v) {
            type = t || v[0].trim().split(/\s+/)[0].toLowerCase()
            break
          }
        }
        if (!type) continue
        const start = text.lastIndexOf('\n', at) + 1
        const endNl = text.indexOf('\n', at)
        const line = text.slice(start, endNl < 0 ? undefined : endNl)
        out.push({ fromId: e.id, toId: id, type: type.toLowerCase(), quote: line.trim().slice(0, 160) })
        seen.add(pair)
        break
      }
    }
  }
  return out
}
