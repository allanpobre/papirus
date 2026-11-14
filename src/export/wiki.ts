import { derivedValue } from '../logic/derivedFields'
import { factSentence } from '../logic/codex'
import { MentionMatcher } from '../logic/detection'
import { readerBook, readerEntities } from '../logic/reader'
import { relationSentence } from '../logic/relations'
import { unmarkReveals } from '../logic/reveals'
import { formatYear, kindLabel, kindPlural, ROLE_LABEL } from '../model/labels'
import type { Entity, Universe, WikiSettings } from '../model/schema'
import { manuscriptOrder } from '../model/universe'
import { readerCopy } from '../share/readerCopy'
import { coverLook } from '../ui/coverLook'
import { centroid } from '../logic/regions'

/**
 * Wiki do mundo: um arquivo HTML só, para mandar a jogadores ou leitores.
 * Nunca leva segredos (fichas, fatos e ligações secretas, trechos [segredo]) nem a Inbox.
 * Com `upTo`, mostra só o que o leitor já sabe até aquela cena (sem spoiler).
 */
export interface WikiOptions {
  /** Imagens das fichas já prontas (referência → data URL), para irem dentro do arquivo. */
  images?: Map<string, string>
  /** Posição da última cena lida (0 = primeira); `null` = tudo que não é segredo. */
  upTo: number | null
}

interface WikiEntry {
  entity: Entity
  summary: string
  description: string
  fields: { key: string; value: string }[]
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const anchor = (id: string) => `f-${id.slice(0, 12)}`

/** A wiki em dados: o mesmo conteúdo do site, para JSON ou texto (sem imagens). */
export interface WikiData {
  formato: 'papirus-wiki'
  versao: 1
  mundo: { nome: string; descricao: string; autor: string }
  recorte: string
  fichas: {
    id: string
    tipo: string
    /** O papel na história (Protagonista, Antagonista…), se a ficha tem. */
    papel: string | null
    /** O tipo no plural, para agrupar ("Personagens"). */
    grupo: string
    nome: string
    apelidos: string[]
    resumo: string
    descricao: string
    campos: { nome: string; valor: string }[]
    ficaEm: string | null
    contem: string[]
    ligacoes: string[]
    fatos: string[]
    linhaDoTempo: string[]
    citadoEm: string[]
    mapas: string[]
  }[]
  linhaDoTempo: { quando: string; titulo: string; descricao: string }[]
  mapas: { nome: string; marcadores: { nome: string; x: number; y: number }[] }[]
}

export function buildWiki(universe: Universe, { upTo, images }: WikiOptions): { html: string; entries: number; data: WikiData } {
  const safe = readerCopy(universe, false)
  const scenes = manuscriptOrder(safe)
  let entries: WikiEntry[]
  let facts: { text: string; ids: string[] }[]
  let relations: { text: string; ids: string[] }[]
  let events: { when: string; year: number; title: string; description: string; ids: string[] }[]
  if (upTo === null) {
    entries = safe.entities.map((e) => ({
      entity: e,
      summary: unmarkReveals(e.summary),
      description: unmarkReveals(e.description),
      // Campo vazio fica de fora, a não ser que as ligações (ou o nascimento) respondam por ele.
      fields: e.fields
        .map((f) => ({ key: f.key, value: unmarkReveals(f.value).trim() || (f.key.trim() ? (derivedValue(safe, e, f.key, { openOnly: true })?.text ?? '') : '') }))
        .filter((f) => f.key.trim() && f.value.trim()),
    }))
    facts = safe.facts.map((f) => ({ text: factSentence(safe, f), ids: [f.subjectId, f.objectId].filter((x): x is string => Boolean(x)) }))
    relations = safe.relations.map((r) => ({ text: relationSentence(safe, r), ids: [r.fromId, r.toId, ...r.via.map((v) => v.entityId)] }))
    const suffix = safe.settings.calendarSuffix
    events = safe.events.map((ev) => ({
      year: ev.year,
      when: ev.endYear !== null ? `${formatYear(ev.year, suffix)} – ${formatYear(ev.endYear, suffix)}` : formatYear(ev.year, suffix),
      title: ev.title,
      description: unmarkReveals(ev.description),
      ids: [...ev.entityIds, ev.placeId].filter((x): x is string => Boolean(x)),
    }))
  } else {
    const book = readerBook(safe)
    entries = readerEntities(book, upTo)
    facts = book.facts.filter((f) => f.at <= upTo).map((f) => ({ text: f.text, ids: f.entityIds }))
    relations = book.relations.filter((r) => r.at <= upTo).map((r) => ({ text: r.text, ids: r.entityIds }))
    events = book.events.filter((e) => e.at <= upTo).map((e) => ({ ...e, ids: e.entityIds }))
  }
  entries.sort((a, b) => a.entity.name.localeCompare(b.entity.name, 'pt-BR'))
  // O que o escritor escolheu em Personalizar: fichas e tipos de fora, campos escondidos, seções e aparência.
  const ws: WikiSettings = universe.settings.wiki ?? {}
  const fold = (t: string) => t.trim().toLocaleLowerCase('pt-BR')
  const hiddenKinds = new Set(ws.hiddenKinds ?? [])
  const hiddenFields = new Set((ws.hiddenFields ?? []).map(fold).filter(Boolean))
  entries = entries
    .filter((x) => !x.entity.wikiHidden && !hiddenKinds.has(x.entity.kind))
    .map((x) => (hiddenFields.size ? { ...x, fields: x.fields.filter((f) => !hiddenFields.has(fold(f.key))) } : x))
  const show = { timeline: ws.timeline !== false, maps: ws.maps !== false, cites: ws.cites !== false, portraits: ws.portraits !== false }
  const title = ws.title?.trim() || universe.name
  const intro = ws.intro?.trim() || universe.description
  const author = ws.author?.trim() || ''
  const visible = new Set(entries.map((e) => e.entity.id))
  const matcher = new MentionMatcher(entries.map((e) => e.entity))

  /** Texto com os nomes de outras fichas viram links. */
  const linked = (text: string, self: string) => {
    let out = ''
    let last = 0
    for (const m of matcher.find(text)) {
      if (m.from < last || m.entityId === self) continue
      out += esc(text.slice(last, m.from)) + `<a href="#${anchor(m.entityId)}">${esc(text.slice(m.from, m.to))}</a>`
      last = m.to
    }
    return out + esc(text.slice(last))
  }
  const paras = (text: string, self: string) =>
    text
      .split(/\n{2,}|\n/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => `<p>${linked(p, self)}</p>`)
      .join('')
  const byKind = new Map<string, WikiEntry[]>()
  for (const e of entries) byKind.set(e.entity.kind, [...(byKind.get(e.entity.kind) ?? []), e])
  const kinds = [...byKind.keys()].sort((a, b) => kindPlural(a).localeCompare(kindPlural(b), 'pt-BR'))
  const img = (ref: string | null | undefined) => (ref ? (images?.get(ref) ?? null) : null)
  const tone = ws.color && /^#[0-9a-f]{6}$/i.test(ws.color) ? ws.color : coverLook(universe.name).tone
  const font = { serifada: "Georgia,'Iowan Old Style',serif", 'sem-serifa': "system-ui,-apple-system,'Segoe UI',Roboto,sans-serif", livro: "'Palatino Linotype','Book Antiqua',Palatino,'URW Palladio L',Georgia,serif" }[ws.font ?? 'serifada']
  // Os estilos: cores do papel, do cabeçalho e ornamentos. Clássico e Moderno seguem o claro/escuro do aparelho.
  const style = ws.style ?? 'classico'
  const look = wikiLook(style)

  /** Quem cita quem: nomes de uma ficha que aparecem no texto de outra (os "Citado em"). */
  const citedBy = new Map<string, Set<string>>()
  for (const x of entries) {
    const text = [x.summary, x.description, ...x.fields.map((f) => f.value)].join('\n')
    for (const m of matcher.find(text)) {
      if (m.entityId === x.entity.id) continue
      citedBy.set(m.entityId, (citedBy.get(m.entityId) ?? new Set()).add(x.entity.id))
    }
  }
  const sortedEvents = show.timeline ? [...events].sort((a, b) => a.year - b.year) : []
  // Ligado ao evento ou citado no texto dele.
  const eventsOf = (id: string) => sortedEvents.filter((ev) => ev.ids.includes(id) || matcher.find(`${ev.title}\n${ev.description}`).some((m) => m.entityId === id))
  const maps = (show.maps ? safe.maps : [])
    .filter((m) => img(m.image))
    .map((m) => ({ ...m, pins: m.pins.filter((p) => visible.has(p.entityId)), regions: (m.regions ?? []).filter((r) => visible.has(r.entityId)) }))
  const mapsOf = (id: string) => maps.filter((m) => m.pins.some((p) => p.entityId === id) || m.regions.some((r) => r.entityId === id))
  const nameOf = (id: string) => entries.find((x) => x.entity.id === id)?.entity.name ?? ''
  const link = (id: string, name = nameOf(id)) => `<a href="#${anchor(id)}">${esc(name)}</a>`

  const article = ({ entity: e, summary, description, fields }: WikiEntry) => {
    const parent = e.parentId && visible.has(e.parentId) ? entries.find((x) => x.entity.id === e.parentId)!.entity : null
    const children = entries.filter((x) => x.entity.parentId === e.id)
    const rels = relations.filter((r) => r.ids.includes(e.id))
    const fs = facts.filter((f) => f.ids.includes(e.id))
    const cites = [...((show.cites && citedBy.get(e.id)) || [])].sort((a, b) => nameOf(a).localeCompare(nameOf(b), 'pt-BR'))
    const evs = eventsOf(e.id)
    const onMaps = mapsOf(e.id)
    const roleText = e.role ? ROLE_LABEL[e.role] : ''
    const search = [e.name, ...e.aliases, kindLabel(e.kind), roleText].join(' ')
    const portrait = show.portraits ? img(e.image) : null
    const box = [
      portrait ? `<img class="portrait" src="${portrait}" alt="${esc(e.name)}"/>` : '',
      fields.length ? `<dl>${fields.map((f) => `<dt>${esc(f.key)}</dt><dd>${linked(f.value, e.id)}</dd>`).join('')}</dl>` : '',
      parent ? `<p class="meta">Fica em ${link(parent.id, parent.name)}.</p>` : '',
      children.length ? `<p class="meta">Contém: ${children.map((c) => link(c.entity.id, c.entity.name)).join(', ')}.</p>` : '',
      onMaps.length ? `<p class="meta">No mapa: ${onMaps.map((m) => `<a href="#mapas">${esc(m.name || 'Mapa')}</a>`).join(', ')}.</p>` : '',
    ].join('')
    // Vizinhas do mesmo tipo, para ler em sequência.
    const same = byKind.get(e.kind)!
    const i = same.findIndex((x) => x.entity.id === e.id)
    const prev = same[i - 1]?.entity
    const next = same[i + 1]?.entity
    return `<article class="entry page" id="${anchor(e.id)}" data-search="${esc(search.toLowerCase())}">
<header><p class="kind">${esc(kindLabel(e.kind))}${roleText ? ` · ${esc(roleText)}` : ''}</p><h2>${esc(e.name)}</h2>${e.aliases.length ? `<p class="aliases">Também: ${e.aliases.map(esc).join(', ')}</p>` : ''}</header>
${summary.trim() ? `<p class="summary">${linked(summary, e.id)}</p>` : ''}
${box ? `<aside class="infobox">${box}</aside>` : ''}
${description.trim() ? (e.kind === 'documento' ? `<div class="doc-text">${paras(description, e.id)}</div>` : paras(description, e.id)) : ''}
${rels.length ? `<h3>Ligações</h3><ul>${[...new Set(rels.map((r) => r.text))].map((t) => `<li>${linked(t, e.id)}</li>`).join('')}</ul>` : ''}
${fs.length ? `<h3>O que se sabe</h3><ul>${[...new Set(fs.map((f) => f.text))].map((t) => `<li>${linked(t, e.id)}</li>`).join('')}</ul>` : ''}
${evs.length ? `<h3>Na linha do tempo</h3><ul>${evs.map((ev) => `<li><span class="when">${esc(ev.when)}</span> ${linked(ev.title, e.id)}</li>`).join('')}</ul>` : ''}
${cites.length ? `<h3>Citado em</h3><p class="cites">${cites.map((id) => link(id)).join(' · ')}</p>` : ''}
<nav class="pager" aria-label="Fichas vizinhas">${prev ? `<a href="#${anchor(prev.id)}">← ${esc(prev.name)}</a>` : '<span></span>'}<a href="#inicio">Todas</a>${next ? `<a href="#${anchor(next.id)}">${esc(next.name)} →</a>` : '<span></span>'}</nav>
</article>`
  }

  const until = upTo !== null && scenes[upTo] ? `até “${scenes[upTo].title || 'Sem título'}”` : 'tudo, menos os segredos'
  const timeline = sortedEvents.length
    ? `<section class="entry page" id="linha-do-tempo" data-search="linha do tempo"><header><h2>Linha do tempo</h2><p class="aliases">${sortedEvents.length} ${sortedEvents.length === 1 ? 'acontecimento' : 'acontecimentos'}</p></header><ol class="timeline">${sortedEvents
        .map((ev) => `<li><span class="when">${esc(ev.when)}</span><strong>${linked(ev.title, '')}</strong>${ev.description ? `<span>${linked(ev.description, '')}</span>` : ''}</li>`)
        .join('')}</ol></section>`
    : ''
  const atlas = maps.length
    ? `<section class="entry page" id="mapas" data-search="mapas"><header><h2>${maps.length === 1 ? 'Mapa' : 'Mapas'}</h2></header>${maps
        .map(
          (m) =>
            `<figure class="map"><div class="map-box"><img src="${img(m.image)}" alt="${esc(m.name || 'Mapa')}"/>${
              m.regions.length
                ? `<svg class="regions" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">${m.regions
                    .map((r) => `<polygon points="${r.points.map(([x, y]) => `${(x * 1000).toFixed(1)},${(y * 1000).toFixed(1)}`).join(' ')}" style="--r:${coverLook(nameOf(r.entityId)).tone}"/>`)
                    .join('')}</svg>${m.regions
                    .map((r) => {
                      const [cx, cy] = centroid(r.points)
                      return `<a class="region" href="#${anchor(r.entityId)}" style="left:${(cx * 100).toFixed(2)}%;top:${(cy * 100).toFixed(2)}%">${esc(nameOf(r.entityId))}</a>`
                    })
                    .join('')}`
                : ''
            }${m.pins
              .map((p) => `<a class="pin" href="#${anchor(p.entityId)}" style="left:${(p.x * 100).toFixed(2)}%;top:${(p.y * 100).toFixed(2)}%"><span>${esc(p.label || nameOf(p.entityId))}</span></a>`)
              .join('')}</div>${m.name ? `<figcaption>${esc(m.name)}</figcaption>` : ''}</figure>`,
        )
        .join('')}</section>`
    : ''
  const cover = img(universe.settings.cover)
  const initial = (s: string) => esc((s.trim()[0] ?? '?').toLocaleUpperCase('pt-BR'))
  const short = (s: string) => (s.length > 110 ? `${s.slice(0, 107).trimEnd()}…` : s)
  const home = `<section class="page" id="inicio">
<div class="hero">${cover ? `<img class="hero-cover" src="${cover}" alt="Capa"/>` : ''}<p class="kicker">Wiki do mundo</p><h1>${esc(title)}</h1>${author ? `<p class="small">por ${esc(author)}</p>` : ''}<p class="orn" aria-hidden="true">${look.orn}</p>${intro.split(/\n+/).map((t) => t.trim()).filter(Boolean).map((t) => `<p>${linked(t, '')}</p>`).join('')}<p class="small">${esc(until)} · ${entries.length} ${entries.length === 1 ? 'ficha' : 'fichas'}</p></div>
${timeline || atlas ? `<div class="more">${timeline ? '<a href="#linha-do-tempo">Linha do tempo</a>' : ''}${atlas ? `<a href="#mapas">${maps.length === 1 ? 'Mapa' : 'Mapas'}</a>` : ''}</div>` : ''}
${kinds
  .map(
    (k) =>
      `<h2 class="group">${esc(kindPlural(k))} <span>${byKind.get(k)!.length}</span></h2><div class="cards">${byKind
        .get(k)!
        .map(
          ({ entity: e, summary }) =>
            `<a class="card" href="#${anchor(e.id)}"><span class="thumb" data-of="${anchor(e.id)}">${initial(e.name)}</span><span><strong>${esc(e.name)}</strong>${summary.trim() ? `<small>${esc(short(summary.trim()))}</small>` : ''}</span></a>`,
        )
        .join('')}</div>`,
  )
  .join('\n')}
</section>`

  const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} — wiki</title>
<meta name="theme-color" content="${tone}">
<style>
:root{--tone:${tone};--font:${font};${look.vars}}
${look.dark ? `@media (prefers-color-scheme:dark){:root{${look.dark}}}` : ''}
*{box-sizing:border-box}html{scroll-padding-top:76px}body{margin:0;background:var(--bg);color:var(--ink);font:17px/1.65 var(--font)}
a{color:var(--accent);text-decoration-thickness:1px;text-underline-offset:2px}
.sans,nav,.bar,.kind,.meta,dt,.when,.small,.card small,.pager,footer,h3,.group,.kicker{font-family:system-ui,-apple-system,'Segoe UI',sans-serif}
.bar{position:sticky;top:0;z-index:5;display:flex;gap:10px;align-items:center;padding:10px 20px;background:var(--bar-bg);color:var(--bar-ink);border-bottom:1px solid var(--bar-line)}
.bar .home{color:var(--bar-ink);text-decoration:none;font:600 1.05rem/1.2 var(--font);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1 1 auto;min-width:0}
.bar input{flex:0 1 280px;min-width:0;padding:9px 14px;border:1px solid var(--bar-line);border-radius:999px;background:var(--bar-field);color:var(--ink);font:15px system-ui,sans-serif}
.bar button{display:none;min-height:40px;padding:0 14px;border:1px solid var(--bar-line);border-radius:999px;background:transparent;color:var(--bar-ink);font:600 14px system-ui,sans-serif}
.wrap{display:grid;grid-template-columns:230px minmax(0,1fr);gap:36px;max-width:1180px;margin:0 auto;padding:28px 20px 56px}
nav#indice{position:sticky;top:84px;align-self:start;max-height:calc(100vh - 100px);overflow:auto;font-size:14px;line-height:1.45}
nav#indice h2{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin:18px 0 6px}nav#indice h2:first-child{margin-top:0}
nav#indice ul{list-style:none;margin:0;padding:0}nav#indice li a{display:block;padding:4px 10px;margin-left:-10px;border-radius:6px;text-decoration:none;color:var(--ink)}
nav#indice li a:hover{color:var(--accent)}nav#indice a[aria-current]{background:var(--soft);color:var(--accent);font-weight:600}
main{min-width:0}
.entry{background:var(--paper);border:var(--entry-border);border-radius:var(--radius);padding:34px 40px;margin-bottom:20px;box-shadow:var(--shadow)}
.entry header{margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid var(--line)}
.entry h2{margin:0;font:400 clamp(1.9rem,4vw,2.5rem)/1.1 var(--font);letter-spacing:-.01em}
.kind{margin:0 0 6px;color:var(--accent);font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase}
.aliases,.meta{color:var(--muted);font-size:.95rem;margin:.35rem 0}.summary{font-size:1.15rem;font-style:italic;color:var(--ink-soft)}
.infobox{float:right;width:270px;margin:4px 0 18px 28px;border:1px solid var(--line);border-radius:calc(var(--radius) * .7);background:var(--soft);overflow:hidden}
.infobox>*:not(.portrait){margin-left:14px;margin-right:14px}.infobox>*:last-child{margin-bottom:14px}.infobox dl{margin-top:12px}
.infobox .meta{font-size:14px;margin-top:.5rem}.portrait{display:block;width:100%;aspect-ratio:4/5;object-fit:cover}
.entry::after{content:'';display:block;clear:both}
h3{font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin:26px 0 8px}
dl{display:grid;grid-template-columns:max-content 1fr;gap:6px 12px;margin:0;font-size:15px}dt{color:var(--muted);font-size:13px;line-height:1.75}dd{margin:0}
ul{margin:0;padding-left:1.2rem}li{margin:.15rem 0}.cites{margin:0}.when{color:var(--muted);font-size:13px;margin-right:6px}
.doc-text{margin:16px 0;padding:6px 0 6px 20px;border-left:3px solid var(--accent);font-style:italic;font-size:1.08rem}
.timeline{list-style:none;padding:0;margin:16px 0 0;border-left:2px solid var(--line)}.timeline li{position:relative;padding:0 0 16px 20px;display:grid}
.timeline li::before{content:'';position:absolute;left:-7px;top:7px;width:12px;height:12px;border-radius:50%;background:var(--paper);border:2px solid var(--accent)}
.pager{display:flex;justify-content:space-between;gap:12px;margin-top:30px;padding-top:14px;border-top:1px solid var(--line);font-size:14px}.pager a{text-decoration:none;padding:6px 0}
.hero{display:flex;flex-direction:column;align-items:center;text-align:center;gap:6px;padding:46px 20px 34px;margin-bottom:8px;color:var(--hero-ink);background:var(--hero-bg);border-radius:var(--radius)}
.hero-cover{width:170px;max-width:46%;border-radius:4px;box-shadow:0 18px 36px -18px rgb(0 0 0/.6);margin-bottom:14px}
.kicker{margin:0;font-size:11px;letter-spacing:.2em;text-transform:uppercase;opacity:.75}
.hero h1{margin:0;font:400 clamp(2.3rem,6vw,3.6rem)/1.05 var(--font);letter-spacing:-.015em;text-wrap:balance}
.hero p{margin:.35rem 0 0;max-width:60ch}.hero .orn{font-size:1.4rem;opacity:.6;margin:6px 0 2px}.small{font-size:14px}
.more{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;margin:12px 0 4px}.more a{padding:8px 16px;border-radius:999px;border:1px solid var(--line);background:var(--paper);text-decoration:none;font:600 14px system-ui,sans-serif}
.group{display:flex;align-items:center;gap:12px;font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);margin:34px 0 12px}.group::after{content:'';flex:1;height:1px;background:var(--line)}.group span{font-weight:400}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px}
.card{display:flex;gap:14px;align-items:center;padding:14px;border:1px solid var(--line);border-radius:calc(var(--radius) * .8);background:var(--paper);text-decoration:none;color:var(--ink);transition:border-color .15s,transform .15s}
.card:hover{border-color:var(--accent);transform:translateY(-1px)}.card strong{display:block;font:600 1.05rem/1.25 var(--font);color:var(--ink)}.card small{display:block;color:var(--muted);font-size:13px;line-height:1.4;margin-top:3px}
.thumb{flex:none;width:52px;height:52px;border-radius:50%;display:grid;place-items:center;background:var(--tone) center/cover;color:#fff;font:400 20px var(--font);box-shadow:0 0 0 3px var(--paper),0 0 0 4px var(--line)}.thumb.img{color:transparent}
.results{list-style:none;padding:0;margin:0;display:grid;gap:8px}.results .card{width:100%}.empty{color:var(--muted)}
.map{margin:18px 0 0}.regions{position:absolute;inset:0;width:100%;height:100%}.regions polygon{fill:color-mix(in srgb,var(--r) 30%,transparent);stroke:var(--r);stroke-width:2;vector-effect:non-scaling-stroke}.region{position:absolute;transform:translate(-50%,-50%);padding:1px 8px;border-radius:999px;background:rgb(0 0 0/.55);color:#fff;font:600 11px system-ui,sans-serif;text-transform:uppercase;letter-spacing:.04em;text-decoration:none;white-space:nowrap}.map-box{position:relative}.map-box>img{display:block;width:100%;height:auto;border-radius:8px}
.pin{position:absolute;transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center;text-decoration:none}
.pin::after{content:'';width:12px;height:12px;border-radius:50%;background:var(--tone);border:2px solid #fff;box-shadow:0 1px 3px rgb(0 0 0/.5)}
.pin span{padding:1px 6px;border-radius:6px;background:rgb(0 0 0/.65);color:#fff;font:12px system-ui,sans-serif;white-space:nowrap;margin-bottom:2px}
figcaption{color:var(--muted);font:14px system-ui,sans-serif;margin-top:6px}
.js .page:not(.on){display:none}.hidden{display:none!important}
footer{max-width:1180px;margin:0 auto;padding:0 20px 36px;color:var(--muted);font-size:13px;text-align:center}
${look.extra}
@media (max-width:760px){
.wrap{grid-template-columns:1fr;padding:16px 14px 40px;gap:16px}.bar{padding:10px 14px}.bar button{display:block}.bar input{flex-basis:0;flex-grow:1}.bar .home{flex:0 1 auto;max-width:34%}
.js nav#indice{display:none;position:static;max-height:none;background:var(--paper);border:1px solid var(--line);border-radius:var(--radius);padding:14px 16px}
.js nav#indice.aberto{display:block}nav#indice li a{padding:9px 10px}
.entry{padding:22px 18px}.infobox{float:none;width:auto;margin:14px 0}.portrait{max-height:360px}.hero{padding:30px 14px 24px}.cards{grid-template-columns:1fr}}
${ws.font === 'livro' ? '.entry p{text-align:justify;hyphens:auto}.entry p:not(.summary)+p{text-indent:1.4em;margin-top:-.6em}' : ''}
@media print{.bar,nav#indice,.pager{display:none!important}.page{display:block!important}.wrap{display:block}.entry{break-inside:avoid}}
</style></head><body class="estilo-${style}">
<header class="bar"><a class="home" href="#inicio">${esc(title)}</a><input type="search" id="busca" placeholder="Procurar…" aria-label="Procurar na wiki"><button type="button" id="menu" aria-expanded="false" aria-controls="indice">Índice</button></header>
<div class="wrap">
<nav id="indice" aria-label="Índice"><h2>Início</h2><ul><li><a href="#inicio">${esc(title)}</a></li>${timeline ? '<li><a href="#linha-do-tempo">Linha do tempo</a></li>' : ''}${atlas ? `<li><a href="#mapas">${maps.length === 1 ? 'Mapa' : 'Mapas'}</a></li>` : ''}</ul>
${kinds.map((k) => `<h2>${esc(kindPlural(k))}</h2><ul>${byKind.get(k)!.map((e) => `<li><a href="#${anchor(e.entity.id)}">${esc(e.entity.name)}</a></li>`).join('')}</ul>`).join('')}
</nav>
<main>${home}
<section class="page" id="resultados" hidden><h2 class="group">Resultados</h2><ul class="results"></ul></section>
${entries.map(article).join('\n')}${timeline}${atlas}</main>
</div>
<footer>${author ? `${esc(author)} · ` : ''}Feito com o Papirus. Sem segredos do autor.</footer>
<script>
(function(){var d=document,root=d.documentElement;root.classList.add('js');
var q=d.getElementById('busca'),nav=d.getElementById('indice'),btn=d.getElementById('menu'),res=d.getElementById('resultados'),list=res.querySelector('ul'),base=d.title;
var pages=[].slice.call(d.querySelectorAll('.page'));
d.querySelectorAll('.thumb[data-of]').forEach(function(t){var p=d.querySelector('#'+t.dataset.of+' .portrait');if(p){t.style.backgroundImage='url('+p.src+')';t.classList.add('img')}});
function show(id){pages.forEach(function(p){p.classList.toggle('on',p.id===id)});res.hidden=id!=='resultados'}
function route(){var id=location.hash.slice(1)||'inicio';if(!d.getElementById(id)||id==='resultados')id='inicio';show(id);q.value='';
nav.querySelectorAll('a').forEach(function(a){if(a.getAttribute('href')==='#'+id)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});
var h=d.querySelector('#'+id+' h2');d.title=id==='inicio'||!h?base:h.textContent+' — '+base;nav.classList.remove('aberto');btn.setAttribute('aria-expanded','false');window.scrollTo(0,0)}
var norm=function(s){return s.normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase()};
q.addEventListener('input',function(){var t=norm(q.value.trim());if(!t){route();return}list.innerHTML='';var n=0;
d.querySelectorAll('.entry').forEach(function(el){if(norm(el.dataset.search+' '+el.textContent).indexOf(t)<0)return;n++;
var h=el.querySelector('h2'),k=el.querySelector('.kind'),s=el.querySelector('.summary'),li=d.createElement('li'),a=d.createElement('a');a.className='card';a.href='#'+el.id;
var b=d.createElement('strong');b.textContent=h?h.textContent:'';a.appendChild(b);var m=d.createElement('small');m.textContent=[k&&k.textContent,s&&s.textContent].filter(Boolean).join(' · ');a.appendChild(m);li.appendChild(a);list.appendChild(li)});
if(!n){var e=d.createElement('li');e.className='empty';e.textContent='Nada com “'+q.value.trim()+'”.';list.appendChild(e)}show('resultados')});
btn.addEventListener('click',function(){var o=nav.classList.toggle('aberto');btn.setAttribute('aria-expanded',String(o))});
// Os links internos mudam só o "#" (na prévia do app, um "#x" solto iria para o endereço do app).
d.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[href^="#"]');if(!a||e.ctrlKey||e.metaKey||e.shiftKey)return;e.preventDefault();var h=a.getAttribute('href');if(location.hash===h||(h==='#inicio'&&!location.hash))route();else location.hash=h.slice(1)});
window.addEventListener('hashchange',route);route()})();
</script>
</body></html>`
  const data: WikiData = {
    formato: 'papirus-wiki',
    versao: 1,
    mundo: { nome: title, descricao: intro, autor: author },
    recorte: until,
    fichas: entries.map(({ entity: e, summary, description, fields }) => ({
      id: e.id,
      tipo: kindLabel(e.kind),
      papel: e.role ? ROLE_LABEL[e.role] : null,
      grupo: kindPlural(e.kind),
      nome: e.name,
      apelidos: e.aliases,
      resumo: summary.trim(),
      descricao: description.trim(),
      campos: fields.map((f) => ({ nome: f.key, valor: f.value })),
      ficaEm: e.parentId && visible.has(e.parentId) ? nameOf(e.parentId) : null,
      contem: entries.filter((x) => x.entity.parentId === e.id).map((x) => x.entity.name),
      ligacoes: [...new Set(relations.filter((r) => r.ids.includes(e.id)).map((r) => r.text))],
      fatos: [...new Set(facts.filter((f) => f.ids.includes(e.id)).map((f) => f.text))],
      linhaDoTempo: eventsOf(e.id).map((ev) => `${ev.when}: ${ev.title}`),
      citadoEm: [...(citedBy.get(e.id) ?? [])].map(nameOf).sort((a, b) => a.localeCompare(b, 'pt-BR')),
      mapas: mapsOf(e.id).map((m) => m.name || 'Mapa'),
    })),
    linhaDoTempo: sortedEvents.map((ev) => ({ quando: ev.when, titulo: ev.title, descricao: ev.description })),
    mapas: maps.map((m) => ({ nome: m.name || 'Mapa', marcadores: m.pins.map((p) => ({ nome: p.label || nameOf(p.entityId), x: p.x, y: p.y })) })),
  }
  return { html, entries: entries.length, data }
}

/** Variáveis de cor e enfeites de cada estilo da wiki. */
function wikiLook(style: NonNullable<WikiSettings['style']>): { vars: string; dark: string; extra: string; orn: string } {
  const accentLight = '--accent:color-mix(in srgb,var(--tone) 85%,#000);--soft:color-mix(in srgb,var(--tone) 8%,var(--paper));--ink-soft:color-mix(in srgb,var(--ink) 80%,var(--paper))'
  const accentDark = '--accent:color-mix(in srgb,var(--tone) 45%,#fff);--soft:color-mix(in srgb,var(--tone) 16%,var(--paper));--ink-soft:color-mix(in srgb,var(--ink) 85%,var(--paper))'
  switch (style) {
    case 'moderno':
      return {
        vars: `--bg:#f3f5f7;--paper:#fff;--ink:#1b1f24;--muted:#5c6570;--line:#e1e5ea;--radius:14px;--shadow:0 1px 2px rgb(0 0 0/.04);--entry-border:1px solid var(--line);--bar-bg:var(--tone);--bar-ink:#fff;--bar-line:rgb(255 255 255/.25);--bar-field:rgb(255 255 255/.95);--hero-bg:linear-gradient(135deg,var(--tone),color-mix(in srgb,var(--tone) 55%,#000));--hero-ink:#fff;${accentLight}`,
        dark: `--bg:#111417;--paper:#191d21;--ink:#e6e9ec;--muted:#98a1aa;--line:#2a3036;--bar-field:#22272c;${accentDark}`,
        extra: '.estilo-moderno .hero{border-radius:18px;margin-top:4px}',
        orn: '',
      }
    case 'pergaminho':
      return {
        vars: `--bg:#e3d3ad;--paper:#f3e7c9;--ink:#3a2817;--muted:#7a5f3e;--line:#c9b285;--radius:4px;--shadow:0 10px 30px -18px rgb(60 40 10/.5);--entry-border:3px double var(--line);--bar-bg:#3a2817;--bar-ink:#f3e7c9;--bar-line:#5a4128;--bar-field:#f3e7c9;--hero-bg:transparent;--hero-ink:var(--ink);--accent:color-mix(in srgb,var(--tone) 60%,#3a2817);--soft:color-mix(in srgb,#c9b285 30%,var(--paper));--ink-soft:#4e3820`,
        dark: '',
        extra:
          '.estilo-pergaminho{background-image:radial-gradient(circle at 20% 10%,rgb(255 255 255/.25),transparent 40%),radial-gradient(circle at 80% 90%,rgb(120 80 30/.18),transparent 45%)}.estilo-pergaminho .entry h2,.estilo-pergaminho .hero h1{font-variant:small-caps;letter-spacing:.02em}.estilo-pergaminho .entry header{border-bottom:1px solid var(--line);text-align:center}.estilo-pergaminho .entry header::after{content:"❦";display:block;color:var(--muted);margin-top:6px}.estilo-pergaminho .card{background:color-mix(in srgb,var(--paper) 70%,transparent)}',
        orn: '✦ ❦ ✦',
      }
    case 'noturno':
      return {
        vars: `--bg:#0d1013;--paper:#151a1f;--ink:#e4e7ea;--muted:#97a0a9;--line:#262c33;--radius:12px;--shadow:none;--entry-border:1px solid var(--line);--bar-bg:#0d1013;--bar-ink:#e4e7ea;--bar-line:#262c33;--bar-field:#1b2127;--hero-bg:radial-gradient(120% 120% at 50% 0%,color-mix(in srgb,var(--tone) 35%,#0d1013),#0d1013 70%);--hero-ink:#fff;${accentDark}`,
        dark: '',
        extra: '.estilo-noturno .thumb{box-shadow:0 0 0 3px var(--paper),0 0 0 4px color-mix(in srgb,var(--tone) 60%,#000)}',
        orn: '✧',
      }
    default:
      return {
        vars: `--bg:#f2ece1;--paper:#fffdf8;--ink:#2a2520;--muted:#6f675b;--line:#e2d9c8;--radius:6px;--shadow:0 1px 0 rgb(0 0 0/.03),0 14px 34px -26px rgb(60 40 20/.45);--entry-border:1px solid var(--line);--bar-bg:var(--paper);--bar-ink:var(--ink);--bar-line:var(--line);--bar-field:var(--bg);--hero-bg:transparent;--hero-ink:var(--ink);${accentLight}`,
        dark: `--bg:#15130f;--paper:#1e1b16;--ink:#ece6da;--muted:#a89f90;--line:#38332a;--bar-field:#15130f;${accentDark}`,
        extra: '.estilo-classico .hero h1{font-weight:400}.estilo-classico .entry{border-top:3px solid var(--accent)}',
        orn: '❦',
      }
  }
}

/** A wiki em Markdown: um arquivo de texto que abre em qualquer editor (e no Obsidian). */
export function wikiMarkdown(data: WikiData): string {
  const out: string[] = [`# ${data.mundo.nome}`, '']
  if (data.mundo.autor) out.push(`_por ${data.mundo.autor}_`, '')
  if (data.mundo.descricao) out.push(data.mundo.descricao, '')
  out.push(`_Wiki do mundo · ${data.recorte} · ${data.fichas.length} fichas_`, '')
  const kinds = [...new Set(data.fichas.map((f) => f.grupo))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  const list = (title: string, items: string[]) => (items.length ? [`**${title}**`, '', ...items.map((t) => `- ${t}`), ''] : [])
  for (const k of kinds) {
    out.push(`## ${k}`, '')
    for (const f of data.fichas.filter((x) => x.grupo === k)) {
      out.push(`### ${f.nome}`, '')
      if (f.apelidos.length) out.push(`_Também: ${f.apelidos.join(', ')}_`, '')
      if (f.resumo) out.push(`> ${f.resumo.replace(/\n+/g, ' ')}`, '')
      if (f.descricao) out.push(f.descricao, '')
      const info = [
        ...f.campos.map((c) => `- **${c.nome}:** ${c.valor}`),
        ...(f.ficaEm ? [`- **Fica em:** ${f.ficaEm}`] : []),
        ...(f.contem.length ? [`- **Contém:** ${f.contem.join(', ')}`] : []),
        ...(f.mapas.length ? [`- **No mapa:** ${f.mapas.join(', ')}`] : []),
      ]
      if (info.length) out.push(...info, '')
      out.push(...list('Ligações', f.ligacoes), ...list('O que se sabe', f.fatos), ...list('Na linha do tempo', f.linhaDoTempo))
      if (f.citadoEm.length) out.push(`**Citado em:** ${f.citadoEm.join(' · ')}`, '')
    }
  }
  if (data.linhaDoTempo.length) {
    out.push('## Linha do tempo', '')
    for (const ev of data.linhaDoTempo) out.push(`- **${ev.quando}** · ${ev.titulo}${ev.descricao ? ` — ${ev.descricao.replace(/\n+/g, ' ')}` : ''}`)
    out.push('')
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n'
}

