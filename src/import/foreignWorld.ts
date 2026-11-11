import { strFromU8, unzipSync } from 'fflate'
import type { Universe } from '../model/schema'
import { draftEntity, insert } from '../model/universe'

/**
 * Trazer um mundo de outro app: notas em Markdown (Obsidian e afins, com cabeçalho YAML e
 * [[ligações]]), exportações em JSON do Kanka e do World Anvil, ou um .zip com isso tudo.
 * Cada nota/artigo vira uma ficha; o tipo sai do cabeçalho, da pasta ou da categoria do app.
 * As menções a outras fichas viram links sozinhas (como em todo o Papirus).
 */
export interface ForeignFile {
  path: string
  text: string
}

export interface ForeignEntity {
  name: string
  kind: string
  summary: string
  description: string
  aliases: string[]
  tags: string[]
}

export type ForeignSource = 'Obsidian (Markdown)' | 'Kanka' | 'World Anvil' | 'JSON'

export interface ForeignWorld {
  entities: ForeignEntity[]
  sources: ForeignSource[]
  /** Arquivos que não deram ficha (imagens, configurações, vazios). */
  skipped: number
}

/** De nomes de tipo (em inglês ou português, de qualquer app) para os tipos do Papirus. */
const KIND_WORDS: [RegExp, string][] = [
  [/charac|person|persona|npc|\bpc\b|people|personag/i, 'personagem'],
  [/locat|place|settle|city|cities|town|region|lugar|local|cidade|landmark|building|geograph/i, 'lugar'],
  [/organi[sz]|famil|faction|guild|house|fac[cç]|casa|ordem|military|government/i, 'faccao'],
  [/race|species|creature|bestiar|esp[eé]cie|criatura|ra[cç]a/i, 'especie'],
  [/item|artifact|artefa|object|weapon|vehicle|material/i, 'artefato'],
  [/relig|deit|god|cult|religi|divin/i, 'religiao'],
  [/cultur|ethnic|tradition|etnia|costume/i, 'cultura'],
  [/spell|magic|abilit|power|magia|feiti|poder/i, 'magia'],
  [/document|journal|note|legend|myth|lenda|carta|letter|prophec|song|cancao|canção/i, 'documento'],
  [/plane|realm|kingdom|nation|country|empire|reino|imp[eé]rio|na[cç][aã]o|plano/i, 'reino'],
]

export function kindFrom(...hints: (string | undefined | null)[]): string {
  for (const h of hints) {
    if (!h) continue
    for (const [re, kind] of KIND_WORDS) if (re.test(h)) return kind
  }
  return 'conceito'
}

/** Tira HTML (Kanka), BBCode e menções do World Anvil, deixando parágrafos de texto. */
export function plainText(raw: string): string {
  return raw
    .replace(/@\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|blockquote)>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\[url[^\]]*\]([^[]*)\[\/url\]/gi, '$1')
    .replace(/\[\/?[a-z0-9]+(?:[=:][^\]]*)?\]/gi, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** A primeira frase (ou o começo) do texto, para o resumo. */
function firstLine(text: string): string {
  const para = text.split(/\n{2,}/).map((p) => p.trim()).find((p) => p && !p.startsWith('#')) ?? ''
  const sentence = para.match(/^.+?[.!?](\s|$)/)?.[0]?.trim() ?? para
  return sentence.length > 180 ? `${sentence.slice(0, 177).trimEnd()}…` : sentence
}

/** Lê um cabeçalho YAML simples (chave: valor, listas em [a, b] ou em linhas com "- "). */
function frontmatter(text: string): { meta: Record<string, string | string[]>; body: string } {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
  if (!m) return { meta: {}, body: text }
  const meta: Record<string, string | string[]> = {}
  let last = ''
  for (const line of m[1].split(/\r?\n/)) {
    const item = line.match(/^\s*-\s+(.*)$/)
    if (item && last) {
      const prev = meta[last]
      meta[last] = [...(Array.isArray(prev) ? prev : prev ? [prev] : []), item[1].replace(/^["']|["']$/g, '')]
      continue
    }
    const kv = line.match(/^([\w-]+)\s*:\s*(.*)$/)
    if (!kv) continue
    last = kv[1].toLowerCase()
    const v = kv[2].trim()
    meta[last] = v.startsWith('[') ? v.slice(1, -1).split(',').map((x) => x.trim().replace(/^["']|["']$/g, '')).filter(Boolean) : v.replace(/^["']|["']$/g, '')
  }
  return { meta, body: text.slice(m[0].length) }
}

const list = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? v.split(/[,;]/).map((x) => x.trim()) : []).filter(Boolean)
const baseName = (path: string) => path.split('/').pop()!.replace(/\.[^.]+$/, '')

function fromMarkdown(f: ForeignFile): ForeignEntity | null {
  const { meta, body } = frontmatter(f.text)
  const h1 = body.match(/^#\s+(.+)$/m)?.[1]?.trim()
  const name = (typeof meta.title === 'string' && meta.title) || h1 || baseName(f.path)
  const text = body
    .replace(/^#\s+.+$/m, '')
    .replace(/!\[\[[^\]]*\]\]|!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  if (!name.trim()) return null
  const folders = f.path.split('/').slice(0, -1)
  const tags = list(meta.tags as string | string[]).map((t) => t.replace(/^#/, ''))
  const typeHint = [meta.type, meta.kind, meta.tipo, meta.categoria, meta.category].find((x) => typeof x === 'string') as string | undefined
  return {
    name: name.trim(),
    kind: kindFrom(typeHint, ...folders.reverse(), ...tags),
    summary: (typeof meta.summary === 'string' && meta.summary) || (typeof meta.resumo === 'string' && meta.resumo) || firstLine(text),
    description: text,
    aliases: list((meta.aliases ?? meta.alias) as string | string[]),
    tags,
  }
}

type Json = Record<string, unknown>
const str = (v: unknown) => (typeof v === 'string' ? v : '')

function fromJsonObject(o: Json, path: string): { entity: ForeignEntity | null; source: ForeignSource } {
  // World Anvil: artigos com title, content (BBCode) e a classe (Person, Location…).
  if ('title' in o && ('content' in o || 'entityClass' in o || 'templateType' in o)) {
    const text = plainText(str(o.content) || str(o.excerpt))
    const name = str(o.title).trim()
    return {
      source: 'World Anvil',
      entity: name ? { name, kind: kindFrom(str(o.entityClass), str(o.templateType), str(o.template), path), summary: plainText(str(o.excerpt)) || firstLine(text), description: text, aliases: [], tags: list(str(o.tags)) } : null,
    }
  }
  // Kanka: entidades com name e entry (HTML); o tipo vem da pasta (characters/, locations/…) ou do "type".
  if ('name' in o && ('entry' in o || 'entity' in o || 'is_private' in o)) {
    const text = plainText(str(o.entry))
    const name = str(o.name).trim()
    return {
      source: 'Kanka',
      entity: name ? { name, kind: kindFrom(path.split('/').slice(-2, -1)[0], str(o.type)), summary: firstLine(text), description: text, aliases: [], tags: [] } : null,
    }
  }
  const name = (str(o.name) || str(o.title) || str(o.nome)).trim()
  const text = plainText(str(o.description) || str(o.descricao) || str(o.content) || str(o.text))
  return { source: 'JSON', entity: name ? { name, kind: kindFrom(str(o.kind), str(o.type), str(o.tipo), path), summary: str(o.summary) || firstLine(text), description: text, aliases: [], tags: [] } : null }
}

/** Abre um .zip em arquivos de texto (Markdown e JSON). */
export function unzipText(name: string, bytes: Uint8Array): ForeignFile[] {
  const out: ForeignFile[] = []
  for (const [path, data] of Object.entries(unzipSync(bytes))) {
    if (!/\.(md|markdown|txt|json)$/i.test(path) || path.split('/').some((p) => p.startsWith('.') || p === '__MACOSX')) continue
    out.push({ path: `${name.replace(/\.zip$/i, '')}/${path}`, text: strFromU8(data) })
  }
  return out
}

export function readForeign(files: ForeignFile[]): ForeignWorld {
  const entities: ForeignEntity[] = []
  const sources = new Set<ForeignSource>()
  let skipped = 0
  for (const f of files) {
    if (/\.json$/i.test(f.path)) {
      let data: unknown
      try {
        data = JSON.parse(f.text)
      } catch {
        skipped++
        continue
      }
      const items = Array.isArray(data) ? data : data && typeof data === 'object' && Array.isArray((data as Json).data) ? ((data as Json).data as unknown[]) : [data]
      let any = false
      for (const item of items) {
        if (!item || typeof item !== 'object') continue
        const { entity, source } = fromJsonObject(item as Json, f.path)
        if (entity) {
          entities.push(entity)
          sources.add(source)
          any = true
        }
      }
      if (!any) skipped++
    } else if (/\.(md|markdown|txt)$/i.test(f.path)) {
      const e = fromMarkdown(f)
      if (e && (e.description || e.summary || e.aliases.length)) {
        entities.push(e)
        sources.add('Obsidian (Markdown)')
      } else skipped++
    } else skipped++
  }
  // Sem repetir nome (o primeiro fica).
  const seen = new Set<string>()
  const unique = entities.filter((e) => {
    const k = e.name.toLocaleLowerCase('pt-BR')
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
  return { entities: unique, sources: [...sources], skipped: skipped + entities.length - unique.length }
}

/** Põe as fichas no universo; as que já existem (mesmo nome) ficam como estão. */
export function applyForeign(u: Universe, world: ForeignWorld): { universe: Universe; created: number; existing: number } {
  const have = new Set(u.entities.map((e) => e.name.toLocaleLowerCase('pt-BR')))
  let created = 0
  let existing = 0
  for (const e of world.entities) {
    if (have.has(e.name.toLocaleLowerCase('pt-BR'))) {
      existing++
      continue
    }
    u = insert(u, 'entities', { ...draftEntity(e.kind, e.name), summary: e.summary, description: e.description, aliases: e.aliases, tags: e.tags })[0]
    have.add(e.name.toLocaleLowerCase('pt-BR'))
    created++
  }
  return { universe: u, created, existing }
}
