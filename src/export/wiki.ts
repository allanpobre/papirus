import { factSentence } from '../logic/codex'
import { MentionMatcher } from '../logic/detection'
import { readerBook, readerEntities } from '../logic/reader'
import { relationSentence } from '../logic/relations'
import { unmarkReveals } from '../logic/reveals'
import { formatYear, kindLabel, kindPlural } from '../model/labels'
import type { Entity, Universe } from '../model/schema'
import { manuscriptOrder } from '../model/universe'
import { readerCopy } from '../share/readerCopy'

/**
 * Wiki do mundo: um arquivo HTML só, para mandar a jogadores ou leitores.
 * Nunca leva segredos (fichas, fatos e ligações secretas, trechos [segredo]) nem a Inbox.
 * Com `upTo`, mostra só o que o leitor já sabe até aquela cena (sem spoiler).
 */
export interface WikiOptions {
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

export function buildWiki(universe: Universe, { upTo }: WikiOptions): { html: string; entries: number } {
  const safe = readerCopy(universe, false)
  const scenes = manuscriptOrder(safe)
  let entries: WikiEntry[]
  let facts: { text: string; ids: string[] }[]
  let relations: { text: string; ids: string[] }[]
  let events: { when: string; year: number; title: string; description: string }[]
  if (upTo === null) {
    entries = safe.entities.map((e) => ({
      entity: e,
      summary: unmarkReveals(e.summary),
      description: unmarkReveals(e.description),
      fields: e.fields.map((f) => ({ key: f.key, value: unmarkReveals(f.value) })).filter((f) => f.key.trim() && f.value.trim()),
    }))
    facts = safe.facts.map((f) => ({ text: factSentence(safe, f), ids: [f.subjectId, f.objectId].filter((x): x is string => Boolean(x)) }))
    relations = safe.relations.map((r) => ({ text: relationSentence(safe, r), ids: [r.fromId, r.toId, ...r.via.map((v) => v.entityId)] }))
    const suffix = safe.settings.calendarSuffix
    events = safe.events.map((ev) => ({
      year: ev.year,
      when: ev.endYear !== null ? `${formatYear(ev.year, suffix)} – ${formatYear(ev.endYear, suffix)}` : formatYear(ev.year, suffix),
      title: ev.title,
      description: unmarkReveals(ev.description),
    }))
  } else {
    const book = readerBook(safe)
    entries = readerEntities(book, upTo)
    facts = book.facts.filter((f) => f.at <= upTo).map((f) => ({ text: f.text, ids: f.entityIds }))
    relations = book.relations.filter((r) => r.at <= upTo).map((r) => ({ text: r.text, ids: r.entityIds }))
    events = book.events.filter((e) => e.at <= upTo)
  }
  entries.sort((a, b) => a.entity.name.localeCompare(b.entity.name, 'pt-BR'))
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

  const article = ({ entity: e, summary, description, fields }: WikiEntry) => {
    const parent = e.parentId && visible.has(e.parentId) ? entries.find((x) => x.entity.id === e.parentId)!.entity : null
    const children = entries.filter((x) => x.entity.parentId === e.id)
    const rels = relations.filter((r) => r.ids.includes(e.id))
    const fs = facts.filter((f) => f.ids.includes(e.id))
    const search = [e.name, ...e.aliases, kindLabel(e.kind)].join(' ')
    return `<article class="entry" id="${anchor(e.id)}" data-search="${esc(search.toLowerCase())}">
<header><p class="kind">${esc(kindLabel(e.kind))}</p><h2>${esc(e.name)}</h2>${e.aliases.length ? `<p class="aliases">Também: ${e.aliases.map(esc).join(', ')}</p>` : ''}</header>
${summary.trim() ? `<p class="summary">${linked(summary, e.id)}</p>` : ''}
${description.trim() ? paras(description, e.id) : ''}
${fields.length ? `<dl>${fields.map((f) => `<dt>${esc(f.key)}</dt><dd>${linked(f.value, e.id)}</dd>`).join('')}</dl>` : ''}
${parent ? `<p class="meta">Fica em <a href="#${anchor(parent.id)}">${esc(parent.name)}</a>.</p>` : ''}
${children.length ? `<p class="meta">Contém: ${children.map((c) => `<a href="#${anchor(c.entity.id)}">${esc(c.entity.name)}</a>`).join(', ')}.</p>` : ''}
${rels.length ? `<h3>Ligações</h3><ul>${[...new Set(rels.map((r) => r.text))].map((t) => `<li>${linked(t, e.id)}</li>`).join('')}</ul>` : ''}
${fs.length ? `<h3>O que se sabe</h3><ul>${[...new Set(fs.map((f) => f.text))].map((t) => `<li>${linked(t, e.id)}</li>`).join('')}</ul>` : ''}
</article>`
  }

  const until = upTo !== null && scenes[upTo] ? `até “${scenes[upTo].title || 'Sem título'}”` : 'tudo, menos os segredos'
  const timeline = events.length
    ? `<section class="entry" id="linha-do-tempo" data-search="linha do tempo"><header><p class="kind">Linha do tempo</p><h2>Linha do tempo</h2></header><ol class="timeline">${events
        .sort((a, b) => a.year - b.year)
        .map((ev) => `<li><span class="when">${esc(ev.when)}</span> <strong>${linked(ev.title, '')}</strong>${ev.description ? `<br><span>${linked(ev.description, '')}</span>` : ''}</li>`)
        .join('')}</ol></section>`
    : ''

  const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(universe.name)} — wiki</title>
<style>
:root{--bg:#f7f6f2;--paper:#fff;--ink:#1d2420;--muted:#5f6a64;--line:#dedbd2;--accent:#1f6f55}
@media (prefers-color-scheme:dark){:root{--bg:#121514;--paper:#1a1e1c;--ink:#e3e8e5;--muted:#9aa59f;--line:#2c3330;--accent:#6fd0ae}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 Georgia,'Iowan Old Style',serif}
a{color:var(--accent)}header.top{padding:24px 16px 8px;max-width:1100px;margin:0 auto}
header.top h1{margin:0;font-size:2rem;line-height:1.15}header.top p{margin:.3rem 0;color:var(--muted);font:14px/1.4 system-ui,sans-serif}
.wrap{display:grid;grid-template-columns:260px 1fr;gap:24px;max-width:1100px;margin:0 auto;padding:8px 16px 48px}
nav{position:sticky;top:12px;align-self:start;max-height:calc(100vh - 24px);overflow:auto;font:14px/1.45 system-ui,sans-serif}
nav input{width:100%;padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:var(--paper);color:var(--ink);font:inherit}
nav h2{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:16px 0 4px}nav ul{list-style:none;margin:0;padding:0}nav li a{display:block;padding:2px 0;text-decoration:none}
main{display:grid;gap:16px;min-width:0}.entry{background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:18px 20px;scroll-margin-top:12px}
.entry h2{margin:0;font-size:1.5rem;line-height:1.2}.kind{margin:0;color:var(--muted);font:12px/1 system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase}
.aliases,.meta{color:var(--muted);font-size:.95rem;margin:.3rem 0}.summary{font-style:italic}
h3{font:600 13px/1.2 system-ui,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin:16px 0 4px}
dl{display:grid;grid-template-columns:max-content 1fr;gap:4px 14px;margin:12px 0}dt{color:var(--muted);font:14px/1.6 system-ui,sans-serif}dd{margin:0}
ul{margin:0;padding-left:1.2rem}.timeline{list-style:none;padding:0;margin:0;display:grid;gap:8px}.when{color:var(--muted);font:13px system-ui,sans-serif}
.entry:target{border-color:var(--accent);box-shadow:0 0 0 2px var(--accent)}.hidden{display:none!important}
footer{max-width:1100px;margin:0 auto;padding:0 16px 32px;color:var(--muted);font:13px system-ui,sans-serif}
@media (max-width:760px){.wrap{grid-template-columns:1fr}nav{position:static;max-height:none}}
</style></head><body>
<header class="top"><h1>${esc(universe.name)}</h1>${universe.description ? `<p>${esc(universe.description)}</p>` : ''}<p>Wiki do mundo · ${esc(until)} · ${entries.length} fichas</p></header>
<div class="wrap">
<nav aria-label="Fichas"><label><span style="position:absolute;left:-9999px">Procurar</span><input type="search" id="busca" placeholder="Procurar ficha…"></label>
${kinds.map((k) => `<h2>${esc(kindPlural(k))}</h2><ul>${byKind.get(k)!.map((e) => `<li data-for="${anchor(e.entity.id)}"><a href="#${anchor(e.entity.id)}">${esc(e.entity.name)}</a></li>`).join('')}</ul>`).join('')}
${timeline ? '<h2>Mais</h2><ul><li data-for="linha-do-tempo"><a href="#linha-do-tempo">Linha do tempo</a></li></ul>' : ''}
</nav>
<main>${entries.map(article).join('\n')}${timeline}</main>
</div>
<footer>Feito com o Papirus. Sem segredos do autor.</footer>
<script>
var q=document.getElementById('busca');var norm=function(s){return s.normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase()};
q.addEventListener('input',function(){var t=norm(q.value.trim());document.querySelectorAll('.entry').forEach(function(el){var hit=!t||norm(el.dataset.search+' '+el.textContent).indexOf(t)>=0;el.classList.toggle('hidden',!hit);var li=document.querySelector('[data-for="'+el.id+'"]');if(li)li.classList.toggle('hidden',!hit)})});
</script>
</body></html>`
  return { html, entries: entries.length }
}
