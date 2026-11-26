import { strToU8, zipSync } from 'fflate'
import { kindPlural } from '../model/labels'
import type { Universe } from '../model/schema'

/*
 * De volta para o Obsidian (auditoria 26, Duda: “se eu mexer aqui, não volta para o meu cofre”). Um .zip com uma
 * pasta por tipo (Personagens, Lugares…) e uma nota por ficha, com os nomes das outras fichas virando [[ligações]] e
 * as ligações do Papirus listadas no fim. Abre como um cofre novo, ou se junta ao antigo. É uma cópia, não uma
 * sincronização: o que mudar no Obsidian volta pelo “Trazer de outro app”.
 * É o mundo do próprio autor: as fichas secretas vão junto, marcadas no topo (“segredo: sim”).
 */

const safe = (name: string) => (name.trim() || 'Sem nome').replace(/[\\/:*?"<>|#^[\]]/g, '-').slice(0, 120)
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Troca os nomes das outras fichas por [[ligações]] (nomes compridos primeiro, sem mexer no que já é [[ligação]]). */
export function linkNames(text: string, names: { name: string; file: string }[], self: string): string {
  let out = text
  for (const { name, file } of names) {
    if (file === self) continue
    const re = new RegExp(`(\\[\\[[^\\]]*\\]\\])|(^|[^\\p{L}\\[])(${esc(name)})(?![\\p{L}\\]])`, 'gu')
    out = out.replace(re, (_m, link, pre, found) => (link ? link : `${pre}[[${file === found ? found : `${file}|${found}`}]]`))
  }
  return out
}

export function obsidianVault(u: Universe): Uint8Array {
  const files: Record<string, Uint8Array> = {}
  const fileOf = new Map(u.entities.map((e) => [e.id, safe(e.name)]))
  const names = u.entities
    .flatMap((e) => [e.name, ...(e.aliases ?? [])].filter((n) => n.trim().length >= 2).map((n) => ({ name: n.trim(), file: fileOf.get(e.id)! })))
    .sort((a, b) => b.name.length - a.name.length)
  const root = safe(u.name || 'Papirus')
  const used = new Set<string>()
  for (const e of u.entities) {
    const folder = safe(kindPlural(e.kind))
    let path = `${root}/${folder}/${fileOf.get(e.id)}.md`
    for (let i = 2; used.has(path); i++) path = `${root}/${folder}/${fileOf.get(e.id)} ${i}.md`
    used.add(path)
    const self = fileOf.get(e.id)!
    const front = [
      '---',
      `tipo: ${e.kind}`,
      e.aliases?.length ? `aliases: [${e.aliases.map((a) => JSON.stringify(a)).join(', ')}]` : '',
      e.tags.length ? `tags: [${e.tags.map((t) => JSON.stringify(t)).join(', ')}]` : '',
      e.canon === 'secreto' ? 'segredo: sim' : '',
      '---',
    ].filter(Boolean)
    const body = [
      `# ${e.name || 'Sem nome'}`,
      e.summary ? linkNames(e.summary, names, self) : '',
      e.description ? linkNames(e.description, names, self) : '',
      ...e.fields.filter((f) => f.value.trim()).map((f) => `**${f.key}:** ${linkNames(f.value, names, self)}`),
    ].filter(Boolean)
    const rels = u.relations
      .filter((r) => r.fromId === e.id && fileOf.has(r.toId))
      .map((r) => `- ${r.type} [[${fileOf.get(r.toId)}]]${r.note ? ` — ${r.note}` : ''}`)
    const text = [...front, '', ...body, ...(rels.length ? ['', '## Ligações', ...rels] : [])].join('\n\n').replace(/\n{3,}/g, '\n\n')
    files[path] = strToU8(text.replace(/^---\n\n/, '---\n').replace(/\n\n---\n\n/, '\n---\n\n'))
  }
  return zipSync(files)
}
