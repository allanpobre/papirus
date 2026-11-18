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
  /** Imagens (png, jpg, webp, gif) vêm com os bytes; o texto fica vazio. */
  bytes?: Uint8Array
}

export interface ForeignEntity {
  name: string
  kind: string
  summary: string
  description: string
  aliases: string[]
  tags: string[]
  /** O que o outro app guardava além do texto (idade, título, moradia…): vira campos da ficha. */
  fields: { key: string; value: string }[]
  /** Privada no app de origem (Kanka "privado", World Anvil "private"): vira segredo, nunca sai em wiki ou leitor. */
  secret: boolean
  /** A imagem que a nota ou o artigo mostrava, se o arquivo veio junto. */
  imageFile: { name: string; bytes: Uint8Array } | null
  /** A referência da imagem já guardada (preenchida na hora de trazer). */
  imageRef?: string
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
    // BBCode do World Anvil: títulos, seções, listas e citações viram texto com a forma que tinham.
    .replace(/\[h[1-6]\]([\s\S]*?)\[\/h[1-6]\]/gi, '\n\n## $1\n\n')
    .replace(/\[section[:=]([^\]]*)\]/gi, '\n\n## $1\n\n')
    .replace(/\[li\]([\s\S]*?)\[\/li\]/gi, '\n- $1')
    .replace(/\[quote[^\]]*\]([\s\S]*?)\[\/quote\]/gi, '\n\n> $1\n\n')
    .replace(/\[\/p\]|\[br\]/gi, '\n\n')
    .replace(/\[img[^\]]*\](?:[\s\S]*?\[\/img\])?/gi, '')
    // HTML do Kanka: itens de lista com marcador, citações em bloco.
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<blockquote[^>]*>/gi, '\n\n> ')
    .replace(/<\/(p|div|h[1-6]|ul|ol|blockquote)>/gi, '\n\n')
    .replace(/<\/li>/gi, '')
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
  // Pula títulos, citações, tabelas, código e listas: o resumo é a primeira frase de texto corrido.
  const para = text.split(/\n{2,}/).map((p) => p.trim()).find((p) => p && !/^(#|>|\||```|-\s)/.test(p)) ?? ''
  const sentence = para.match(/^.+?[.!?](\s|$)/)?.[0]?.trim() ?? para
  return sentence.length > 180 ? `${sentence.slice(0, 177).trimEnd()}…` : sentence
}

/** Lê um cabeçalho YAML simples (chave: valor, listas em [a, b] ou em linhas com "- "). */
function frontmatter(text: string): { meta: Record<string, string | string[]>; props: [string, string | string[]][]; body: string } {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
  if (!m) return { meta: {}, props: [], body: text }
  const meta: Record<string, string | string[]> = {}
  // As propriedades como o autor escreveu (com a caixa das chaves, na ordem), para virarem campos.
  const props: [string, string | string[]][] = []
  let last = ''
  let lastRaw = ''
  for (const line of m[1].split(/\r?\n/)) {
    const item = line.match(/^\s*-\s+(.*)$/)
    if (item && last) {
      const prev = meta[last]
      const next = [...(Array.isArray(prev) ? prev : prev ? [prev] : []), item[1].replace(/^["']|["']$/g, '')]
      meta[last] = next
      const at = props.findIndex(([k]) => k === lastRaw)
      if (at >= 0) props[at] = [lastRaw, next]
      continue
    }
    const kv = line.match(/^([^\s:][^:]*?)\s*:\s*(.*)$/)
    if (!kv) continue
    lastRaw = kv[1].trim()
    last = lastRaw.toLowerCase()
    const v = kv[2].trim()
    const value = v.startsWith('[') && !v.startsWith('[[') ? v.slice(1, -1).split(',').map((x) => x.trim().replace(/^["']|["']$/g, '')).filter(Boolean) : v.replace(/^["']|["']$/g, '')
    meta[last] = value
    props.push([lastRaw, value])
  }
  return { meta, props, body: text.slice(m[0].length) }
}

const list = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? v.split(/[,;]/).map((x) => x.trim()) : []).filter(Boolean)
const baseName = (path: string) => path.split('/').pop()!.replace(/\.[^.]+$/, '')
const IMAGE = /\.(png|jpe?g|webp|gif)$/i
const fileName = (path: string) => path.split('/').pop()!
const norm = (name: string) => {
  let n = name.trim()
  try {
    n = decodeURIComponent(n)
  } catch {
    // Nome com "%" solto: fica como está.
  }
  return fileName(n.replace(/\|.*$/, '')).toLocaleLowerCase('pt-BR')
}

/** Pastas de modelo do Obsidian (Templates, Modelos): são moldes, não fichas. */
const isTemplate = (path: string, text: string) => path.split('/').some((p) => /^(templates?|modelos?)$/i.test(p)) || /\{\{\s*(title|date|time)[^}]*\}\}|<%[-_]?\s*tp\./i.test(text)

/** O que o Obsidian guarda no cabeçalho e que não é conteúdo da ficha (não vira campo). */
const SKIP_PROPS = new Set(['title', 'aliases', 'alias', 'tags', 'tag', 'type', 'kind', 'tipo', 'categoria', 'category', 'summary', 'resumo', 'cssclasses', 'cssclass', 'banner', 'banner_icon', 'created', 'modified', 'date created', 'date modified', 'publish', 'permalink', 'position', 'image', 'imagem', 'cover', 'capa'])

/** [[Página#Título|nome]] → nome; [[Página#Título]] e [[Página#^bloco]] → Página. */
const unlink = (t: string) =>
  t
    .replace(/\[\[([^\]|]+?)(?:#[^\]|]*)?\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]|#]+)(?:#[^\]]*)?\]\]/g, '$1')

function fromMarkdown(f: ForeignFile): ForeignEntity | null {
  const { meta, props, body } = frontmatter(f.text)
  const h1 = body.match(/^#\s+(.+)$/m)?.[1]?.trim()
  const name = (typeof meta.title === 'string' && meta.title) || h1 || baseName(f.path)
  if (!name.trim() || isTemplate(f.path, f.text)) return null
  // A imagem da nota: o primeiro anexo mostrado (![[x.png]] ou ![](x.png)) ou a do cabeçalho.
  const embed = body.match(/!\[\[([^\]]+\.(?:png|jpe?g|webp|gif))(?:\|[^\]]*)?\]\]/i)?.[1] ?? body.match(/!\[[^\]]*\]\((?!https?:)([^)\s]+\.(?:png|jpe?g|webp|gif))(?:\s+"[^"]*")?\)/i)?.[1]
  const headImage = [meta.image, meta.imagem, meta.cover, meta.capa, meta.banner].find((x): x is string => typeof x === 'string' && IMAGE.test(unlink(x)))
  const image = embed ?? (headImage ? unlink(headImage) : null)
  const inlineTags = new Set<string>()
  const text = unlink(
    body
      .replace(/```(?:dataview|dataviewjs|query|tasks|button)[\s\S]*?```/gi, '')
      .replace(/%%[\s\S]*?%%/g, '')
      .replace(/^#\s+.+$/m, '')
      .replace(/!\[\[[^\]]*\]\]|!\[[^\]]*\]\([^)]*\)/g, '')
      // Chamadas: "> [!quote] Título" vira só a citação, com o título.
      .replace(/^(>\s*)\[![\w-]+\][+-]?[ \t]*(.*)$/gm, (_, q: string, title: string) => (title ? `${q}${title}` : q.trimEnd()))
      // Identificador de bloco no fim da linha ("... ^origem").
      .replace(/[ \t]+\^[\w-]+[ \t]*$/gm, '')
      // #etiquetas no meio do texto: viram etiquetas da ficha (e ficam como palavra).
      .replace(/(^|[\s(])#([\p{L}][\p{L}\d_/-]*)/gu, (_, pre: string, tag: string) => {
        inlineTags.add(tag)
        return `${pre}${tag}`
      }),
  )
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  const folders = f.path.split('/').slice(0, -1)
  const tags = [...new Set([...list(meta.tags as string | string[]), ...list(meta.tag as string | string[])].map((t) => t.replace(/^#/, '')).concat([...inlineTags]))]
  const typeHint = [meta.type, meta.kind, meta.tipo, meta.categoria, meta.category].find((x) => typeof x === 'string') as string | undefined
  const fields = props
    .filter(([k]) => !SKIP_PROPS.has(k.toLowerCase()))
    .map(([k, v]) => ({ key: k, value: unlink(Array.isArray(v) ? v.join(', ') : v).trim() }))
    .filter((x) => x.value)
  return {
    name: name.trim(),
    kind: kindFrom(typeHint, ...folders.reverse(), ...tags),
    summary: (typeof meta.summary === 'string' && meta.summary) || (typeof meta.resumo === 'string' && meta.resumo) || firstLine(text),
    description: text,
    aliases: list((meta.aliases ?? meta.alias) as string | string[]),
    tags,
    fields,
    secret: false,
    imageFile: image ? { name: image, bytes: new Uint8Array() } : null,
  }
}

type Json = Record<string, unknown>
const str = (v: unknown) => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '')

/** Kanka: o tipo do que se lê pelo nome do arquivo ou da pasta (characters.json, locations/3.json…), no singular do app. */
const KANKA_TYPES: Record<string, string> = {
  characters: 'character', locations: 'location', organisations: 'organisation', organizations: 'organisation', families: 'family', items: 'item', notes: 'note', races: 'race',
  quests: 'quest', journals: 'journal', creatures: 'creature', events: 'event', abilities: 'ability', maps: 'map', timelines: 'timeline', tags: 'tag', calendars: 'calendar',
}
const kankaTypeOf = (path: string): string | null => {
  const parts = path.replace(/\.[^.]+$/, '').toLowerCase().split('/')
  for (const part of [parts[parts.length - 1], parts[parts.length - 2]]) if (part && KANKA_TYPES[part]) return KANKA_TYPES[part]
  return null
}

/** Os campos simples de uma entidade do Kanka que a ficha pode guardar. */
const KANKA_FIELDS: [string, string][] = [
  ['title', 'Título'],
  ['type', 'Tipo'],
  ['age', 'Idade'],
  ['sex', 'Sexo'],
  ['gender', 'Gênero'],
  ['pronouns', 'Pronomes'],
]

const tagList = (v: unknown): string[] => (typeof v === 'string' ? v.split(',') : Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []).map((t) => t.trim()).filter(Boolean)

interface JsonItem {
  obj: Json
  path: string
}

/** De onde ler os itens de um .json: uma lista, ou um objeto com a lista em data, articles, entities, items ou results. */
function jsonItems(data: unknown): unknown[] {
  if (Array.isArray(data)) return data
  if (data && typeof data === 'object') {
    const o = data as Json
    for (const key of ['data', 'articles', 'entities', 'items', 'results']) if (Array.isArray(o[key])) return o[key] as unknown[]
  }
  return [data]
}

function fromJsonObject(o: Json, path: string, mentions: Map<string, string>): { entity: ForeignEntity | null; source: ForeignSource } {
  const blank = { fields: [], secret: false, imageFile: null }
  // World Anvil: artigos com title, content (BBCode) e a classe (Person, Location…).
  if ('title' in o && ('content' in o || 'entityClass' in o || 'templateType' in o)) {
    const text = plainText(str(o.content) || str(o.excerpt))
    const name = str(o.title).trim()
    return {
      source: 'World Anvil',
      entity: name
        ? {
            name,
            kind: kindFrom(str(o.entityClass), str(o.templateType), str(o.template), path),
            summary: plainText(str(o.excerpt)) || firstLine(text),
            description: text,
            aliases: [],
            tags: tagList(o.tags),
            ...blank,
            // Artigo privado no World Anvil: segredo aqui.
            secret: str(o.state).toLowerCase() === 'private',
          }
        : null,
    }
  }
  // Kanka: entidades com name e entry (HTML); o tipo vem do arquivo ou da pasta (characters, locations…) e do "type".
  if ('name' in o && ('entry' in o || 'entity' in o || 'is_private' in o || 'entity_id' in o)) {
    // O texto já com os links escritos (entry_parsed); senão, as menções "[character:1]" trocadas pelo nome.
    const raw = str(o.entry_parsed) || str(o.entry).replace(/\[([a-z_]+):(\d+)(?:\|([^\]]*))?\]/g, (_, type: string, id: string, alias?: string) => alias?.trim() || mentions.get(`${type}:${id}`) || '')
    const text = plainText(raw).replace(/ {2,}/g, ' ')
    const name = str(o.name).trim()
    const fields = KANKA_FIELDS.map(([k, label]) => ({ key: label, value: str(o[k]).trim() })).filter((x) => x.value)
    const type = kankaTypeOf(path)
    return {
      source: 'Kanka',
      entity: name ? { name, kind: kindFrom(type, path.split('/').slice(-2, -1)[0], str(o.type)), summary: firstLine(text), description: text, aliases: [], tags: tagList(o.tags).filter((t) => !/^\d+$/.test(t)), ...blank, fields, secret: o.is_private === true } : null,
    }
  }
  const name = (str(o.name) || str(o.title) || str(o.nome)).trim()
  const text = plainText(str(o.description) || str(o.descricao) || str(o.content) || str(o.text))
  return {
    source: 'JSON',
    entity: name ? { name, kind: kindFrom(str(o.kind), str(o.type), str(o.tipo), path), summary: str(o.summary) || firstLine(text), description: text, aliases: [], tags: [], ...blank } : null,
  }
}

/** Abre um .zip em arquivos (Markdown, JSON e imagens). */
export function unzipText(name: string, bytes: Uint8Array): ForeignFile[] {
  const out: ForeignFile[] = []
  let files = 0
  let total = 0
  const wanted = (path: string) => /\.(md|markdown|txt|json|png|jpe?g|webp|gif)$/i.test(path) && !path.split('/').some((p) => p.startsWith('.') || p === '__MACOSX')
  const unzipped = unzipSync(bytes, {
    // Só abre os textos e as imagens, cada um até 10 MB, até 5.000 arquivos e 200 MB no total.
    filter: (f) => {
      if (!wanted(f.name) || f.originalSize > 10_000_000 || files >= 5000 || total + f.originalSize > 200_000_000) return false
      files++
      total += f.originalSize
      return true
    },
  })
  for (const [path, data] of Object.entries(unzipped)) {
    if (!wanted(path)) continue
    const at = `${name.replace(/\.zip$/i, '')}/${path}`
    out.push(IMAGE.test(path) ? { path: at, text: '', bytes: data } : { path: at, text: strFromU8(data) })
  }
  return out
}

export function readForeign(files: ForeignFile[]): ForeignWorld {
  const entities: ForeignEntity[] = []
  const sources = new Set<ForeignSource>()
  let skipped = 0
  const images = new Map<string, Uint8Array>()
  const items: JsonItem[] = []
  for (const f of files) {
    if (IMAGE.test(f.path)) {
      if (f.bytes) images.set(norm(f.path), f.bytes)
      continue
    }
    if (/\.json$/i.test(f.path)) {
      let data: unknown
      try {
        data = JSON.parse(f.text)
      } catch {
        skipped++
        continue
      }
      const before = items.length
      for (const item of jsonItems(data)) if (item && typeof item === 'object') items.push({ obj: item as Json, path: f.path })
      if (items.length === before) skipped++
    } else if (/\.(md|markdown|txt)$/i.test(f.path)) {
      const e = fromMarkdown(f)
      if (e && (e.description || e.summary || e.aliases.length)) {
        entities.push(e)
        sources.add('Obsidian (Markdown)')
      } else skipped++
    } else skipped++
  }
  // Menções do Kanka ("[character:1]"): o nome de cada uma, para o texto não perder quem era.
  const mentions = new Map<string, string>()
  for (const { obj, path } of items) {
    const type = kankaTypeOf(path)
    const id = obj.id ?? obj.entity_id
    if (type && typeof obj.name === 'string' && id !== undefined) mentions.set(`${type}:${id}`, obj.name)
  }
  for (const { obj, path } of items) {
    const { entity, source } = fromJsonObject(obj, path, mentions)
    if (entity) {
      entities.push(entity)
      sources.add(source)
    } else skipped++
  }
  // As imagens que as notas mostram e vieram junto (pelo nome do arquivo).
  let used = 0
  for (const e of entities) {
    if (!e.imageFile) continue
    const bytes = images.get(norm(e.imageFile.name))
    if (bytes) {
      e.imageFile = { name: fileName(e.imageFile.name.replace(/\|.*$/, '')), bytes }
      used++
    } else e.imageFile = null
  }
  // Sem repetir nome (o primeiro fica).
  const seen = new Set<string>()
  const unique = entities.filter((e) => {
    const k = e.name.toLocaleLowerCase('pt-BR')
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
  return { entities: unique, sources: [...sources], skipped: skipped + entities.length - unique.length + Math.max(0, images.size - used) }
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
    u = insert(u, 'entities', {
      ...draftEntity(e.kind, e.name),
      summary: e.summary,
      description: e.description,
      aliases: e.aliases,
      tags: e.tags,
      fields: e.fields.map((f) => ({ key: f.key, value: f.value })),
      ...(e.secret ? { canon: 'secreto' as const } : {}),
      ...(e.imageRef ? { image: e.imageRef } : {}),
    })[0]
    have.add(e.name.toLocaleLowerCase('pt-BR'))
    created++
  }
  return { universe: u, created, existing }
}
