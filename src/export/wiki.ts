import { derivedValue } from '../logic/derivedFields'
import { factSentence } from '../logic/codex'
import { MentionMatcher } from '../logic/detection'
import { readerBook, readerEntities } from '../logic/reader'
import { relationSentence } from '../logic/relations'
import { unmarkReveals } from '../logic/reveals'
import { formatYear, kindLabel, kindPlural } from '../model/labels'
import type { Entity, Universe } from '../model/schema'
import { manuscriptOrder } from '../model/universe'
import { readerCopy } from '../share/readerCopy'
import { coverLook } from '../ui/coverLook'

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

export function buildWiki(universe: Universe, { upTo, images }: WikiOptions): { html: string; entries: number } {
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
  const img = (ref: string | null | undefined) => (ref ? (images?.get(ref) ?? null) : null)
  const tone = coverLook(universe.name).tone

  /** Quem cita quem: nomes de uma ficha que aparecem no texto de outra (os "Citado em"). */
  const citedBy = new Map<string, Set<string>>()
  for (const x of entries) {
    const text = [x.summary, x.description, ...x.fields.map((f) => f.value)].join('\n')
    for (const m of matcher.find(text)) {
      if (m.entityId === x.entity.id) continue
      citedBy.set(m.entityId, (citedBy.get(m.entityId) ?? new Set()).add(x.entity.id))
    }
  }
  const sortedEvents = [...events].sort((a, b) => a.year - b.year)
  const eventsOf = (id: string) => sortedEvents.filter((ev) => matcher.find(`${ev.title}\n${ev.description}`).some((m) => m.entityId === id))
  const maps = safe.maps
    .filter((m) => img(m.image))
    .map((m) => ({ ...m, pins: m.pins.filter((p) => visible.has(p.entityId)) }))
  const mapsOf = (id: string) => maps.filter((m) => m.pins.some((p) => p.entityId === id))
  const nameOf = (id: string) => entries.find((x) => x.entity.id === id)?.entity.name ?? ''
  const link = (id: string, name = nameOf(id)) => `<a href="#${anchor(id)}">${esc(name)}</a>`

  const article = ({ entity: e, summary, description, fields }: WikiEntry) => {
    const parent = e.parentId && visible.has(e.parentId) ? entries.find((x) => x.entity.id === e.parentId)!.entity : null
    const children = entries.filter((x) => x.entity.parentId === e.id)
    const rels = relations.filter((r) => r.ids.includes(e.id))
    const fs = facts.filter((f) => f.ids.includes(e.id))
    const cites = [...(citedBy.get(e.id) ?? [])].sort((a, b) => nameOf(a).localeCompare(nameOf(b), 'pt-BR'))
    const evs = eventsOf(e.id)
    const onMaps = mapsOf(e.id)
    const search = [e.name, ...e.aliases, kindLabel(e.kind)].join(' ')
    const portrait = img(e.image)
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
<header><p class="kind">${esc(kindLabel(e.kind))}</p><h2>${esc(e.name)}</h2>${e.aliases.length ? `<p class="aliases">Também: ${e.aliases.map(esc).join(', ')}</p>` : ''}</header>
${summary.trim() ? `<p class="summary">${linked(summary, e.id)}</p>` : ''}
${box ? `<aside class="infobox">${box}</aside>` : ''}
${description.trim() ? paras(description, e.id) : ''}
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
            `<figure class="map"><div class="map-box"><img src="${img(m.image)}" alt="${esc(m.name || 'Mapa')}"/>${m.pins
              .map((p) => `<a class="pin" href="#${anchor(p.entityId)}" style="left:${(p.x * 100).toFixed(2)}%;top:${(p.y * 100).toFixed(2)}%"><span>${esc(p.label || nameOf(p.entityId))}</span></a>`)
              .join('')}</div>${m.name ? `<figcaption>${esc(m.name)}</figcaption>` : ''}</figure>`,
        )
        .join('')}</section>`
    : ''
  const cover = img(universe.settings.cover)
  const initial = (s: string) => esc((s.trim()[0] ?? '?').toLocaleUpperCase('pt-BR'))
  const short = (s: string) => (s.length > 110 ? `${s.slice(0, 107).trimEnd()}…` : s)
  const home = `<section class="page" id="inicio">
<div class="hero"${cover ? ` style="background-image:linear-gradient(180deg,rgb(0 0 0/.15),rgb(0 0 0/.65)),url(${cover})"` : ''}><h1>${esc(universe.name)}</h1>${universe.description ? `<p>${esc(universe.description)}</p>` : ''}<p class="small">Wiki do mundo · ${esc(until)} · ${entries.length} ${entries.length === 1 ? 'ficha' : 'fichas'}</p></div>
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
<title>${esc(universe.name)} — wiki</title>
<meta name="theme-color" content="${tone}">
<style>
:root{--bg:#f7f6f2;--paper:#fff;--ink:#1d2420;--muted:#5f6a64;--line:#dedbd2;--tone:${tone};--accent:var(--tone);--soft:color-mix(in srgb,var(--tone) 10%,var(--paper))}
@media (prefers-color-scheme:dark){:root{--bg:#121514;--paper:#1a1e1c;--ink:#e3e8e5;--muted:#9aa59f;--line:#2c3330;--accent:color-mix(in srgb,var(--tone) 45%,#fff);--soft:color-mix(in srgb,var(--tone) 22%,var(--paper))}}
*{box-sizing:border-box}html{scroll-padding-top:72px}body{margin:0;background:var(--bg);color:var(--ink);font:17px/1.6 Georgia,'Iowan Old Style',serif}
a{color:var(--accent)}.sans,nav,.bar,.kind,.meta,dt,.when,.small,.card small,.pager,footer,h3,.group{font-family:system-ui,sans-serif}
.bar{position:sticky;top:0;z-index:5;display:flex;gap:10px;align-items:center;padding:10px 16px;background:var(--tone);color:#fff}
.bar .home{color:#fff;text-decoration:none;font-weight:600;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1 1 auto;min-width:0}
.bar input{flex:0 1 260px;min-width:0;padding:9px 12px;border:0;border-radius:999px;background:rgb(255 255 255/.92);color:#1d2420;font:15px system-ui,sans-serif}
.bar button{display:none;min-height:40px;padding:0 14px;border:1px solid rgb(255 255 255/.5);border-radius:999px;background:transparent;color:#fff;font:600 14px system-ui,sans-serif}
.wrap{display:grid;grid-template-columns:240px minmax(0,1fr);gap:28px;max-width:1160px;margin:0 auto;padding:20px 16px 48px}
nav#indice{position:sticky;top:72px;align-self:start;max-height:calc(100vh - 88px);overflow:auto;font-size:14px;line-height:1.45}
nav#indice h2{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:16px 0 4px}nav#indice h2:first-child{margin-top:0}
nav#indice ul{list-style:none;margin:0;padding:0}nav#indice li a{display:block;padding:3px 8px;margin-left:-8px;border-radius:6px;text-decoration:none}
nav#indice a[aria-current]{background:var(--soft);font-weight:600}
main{min-width:0}.entry{background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:22px 24px;margin-bottom:16px}
.entry h2{margin:0;font-size:1.9rem;line-height:1.15}.kind{margin:0 0 4px;color:var(--accent);font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase}
.aliases,.meta{color:var(--muted);font-size:.95rem;margin:.3rem 0}.summary{font-size:1.1rem;font-style:italic}
.infobox{float:right;width:260px;margin:4px 0 16px 24px;padding:12px;border:1px solid var(--line);border-radius:12px;background:var(--soft)}
.infobox .meta{font-size:14px;margin:.4rem 0 0}.portrait{display:block;width:100%;aspect-ratio:4/5;object-fit:cover;border-radius:8px;margin-bottom:8px}
.entry::after{content:'';display:block;clear:both}
h3{font-size:13px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin:20px 0 6px}
dl{display:grid;grid-template-columns:max-content 1fr;gap:4px 12px;margin:0;font-size:15px}dt{color:var(--muted);font-size:13px;line-height:1.75}dd{margin:0}
ul{margin:0;padding-left:1.2rem}.cites{margin:0}.when{color:var(--muted);font-size:13px;margin-right:6px}
.timeline{list-style:none;padding:0;margin:12px 0 0;border-left:2px solid var(--line)}.timeline li{position:relative;padding:0 0 14px 18px;display:grid}
.timeline li::before{content:'';position:absolute;left:-7px;top:6px;width:12px;height:12px;border-radius:50%;background:var(--accent)}
.pager{display:flex;justify-content:space-between;gap:12px;margin-top:24px;padding-top:12px;border-top:1px solid var(--line);font-size:14px}.pager a{text-decoration:none;padding:6px 0}
.hero{border-radius:16px;padding:40px 28px 24px;margin-bottom:16px;color:#fff;background:linear-gradient(135deg,var(--tone),color-mix(in srgb,var(--tone) 55%,#000));background-size:cover;background-position:center;min-height:200px;display:flex;flex-direction:column;justify-content:flex-end}
.hero h1{margin:0;font-size:clamp(2rem,5vw,3rem);line-height:1.1}.hero p{margin:.4rem 0 0;max-width:62ch;opacity:.92}.small{font-size:14px}
.more{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 8px}.more a{padding:8px 14px;border-radius:999px;background:var(--soft);text-decoration:none;font:600 14px system-ui,sans-serif}
.group{font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:24px 0 8px}.group span{font-weight:400}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px}
.card{display:flex;gap:12px;align-items:flex-start;padding:12px;border:1px solid var(--line);border-radius:12px;background:var(--paper);text-decoration:none;color:var(--ink)}
.card:hover{border-color:var(--accent)}.card strong{display:block;color:var(--accent)}.card small{display:block;color:var(--muted);font-size:13px;line-height:1.4;margin-top:2px}
.thumb{flex:none;width:44px;height:44px;border-radius:10px;display:grid;place-items:center;background:var(--tone) center/cover;color:#fff;font:600 18px Georgia,serif}.thumb.img{color:transparent}
.results{list-style:none;padding:0;margin:0;display:grid;gap:8px}.results .card{width:100%}.empty{color:var(--muted)}
.map{margin:16px 0 0}.map-box{position:relative}.map-box>img{display:block;width:100%;height:auto;border-radius:10px}
.pin{position:absolute;transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center;text-decoration:none}
.pin::after{content:'';width:12px;height:12px;border-radius:50%;background:var(--tone);border:2px solid #fff;box-shadow:0 1px 3px rgb(0 0 0/.5)}
.pin span{padding:1px 6px;border-radius:6px;background:rgb(0 0 0/.65);color:#fff;font:12px system-ui,sans-serif;white-space:nowrap;margin-bottom:2px}
figcaption{color:var(--muted);font:14px system-ui,sans-serif;margin-top:6px}
.js .page:not(.on){display:none}.hidden{display:none!important}
footer{max-width:1160px;margin:0 auto;padding:0 16px 32px;color:var(--muted);font-size:13px}
@media (max-width:760px){
.wrap{grid-template-columns:1fr;padding-top:12px}.bar button{display:block}.bar input{flex-basis:0;flex-grow:1}.bar .home{flex:0 1 auto;max-width:34%}
.js nav#indice{display:none;position:static;max-height:none;background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:14px 16px}
.js nav#indice.aberto{display:block}nav#indice li a{padding:9px 8px}
.entry{padding:18px 16px}.infobox{float:none;width:auto;margin:12px 0}.portrait{max-height:340px}.hero{padding:28px 18px 18px;min-height:160px}}
@media print{.bar,nav#indice,.pager{display:none!important}.page{display:block!important}.wrap{display:block}.entry{break-inside:avoid}}
</style></head><body>
<header class="bar"><a class="home" href="#inicio">${esc(universe.name)}</a><input type="search" id="busca" placeholder="Procurar…" aria-label="Procurar na wiki"><button type="button" id="menu" aria-expanded="false" aria-controls="indice">Índice</button></header>
<div class="wrap">
<nav id="indice" aria-label="Índice"><h2>Início</h2><ul><li><a href="#inicio">${esc(universe.name)}</a></li>${timeline ? '<li><a href="#linha-do-tempo">Linha do tempo</a></li>' : ''}${atlas ? `<li><a href="#mapas">${maps.length === 1 ? 'Mapa' : 'Mapas'}</a></li>` : ''}</ul>
${kinds.map((k) => `<h2>${esc(kindPlural(k))}</h2><ul>${byKind.get(k)!.map((e) => `<li><a href="#${anchor(e.entity.id)}">${esc(e.entity.name)}</a></li>`).join('')}</ul>`).join('')}
</nav>
<main>${home}
<section class="page" id="resultados" hidden><h2 class="group">Resultados</h2><ul class="results"></ul></section>
${entries.map(article).join('\n')}${timeline}${atlas}</main>
</div>
<footer>Feito com o Papirus. Sem segredos do autor.</footer>
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
window.addEventListener('hashchange',route);route()})();
</script>
</body></html>`
  return { html, entries: entries.length }
}
