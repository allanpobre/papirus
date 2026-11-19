#!/usr/bin/env node
/*
 * Revisão automática da tradução de Oz (src/model/ozTexto.ts e ozOutros.ts). Não muda nada: lista o que
 * parece erro para alguém decidir.
 * - palavras que ficaram em inglês;
 * - nomes escritos de dois jeitos (Totó/Toto);
 * - aspas retas, travessão trocado por hífen e espaços estranhos;
 * - frases repetidas (iguais, com mais de 40 letras).
 * Uso: node scripts/revisar-oz.mjs [--json]
 */
import { readFileSync } from 'node:fs'

const FILES = ['src/model/ozTexto.ts', 'src/model/ozOutros.ts']

/** O dado de cada arquivo é JSON depois do "= " (o arquivo é gerado assim). */
function load(file) {
  const src = readFileSync(file, 'utf8')
  const start = src.indexOf('= ') + 2
  const data = JSON.parse(src.slice(start).trim().replace(/;?\s*$/, ''))
  const books = Array.isArray(data) ? { livro: data } : data
  const out = []
  for (const [book, chapters] of Object.entries(books))
    chapters.forEach((ch, c) => ch.paragrafos.forEach((p, i) => out.push({ file, where: `${book} · cap. ${c + 1} (${ch.titulo}) · § ${i + 1}`, text: p })))
  return out
}

const paragraphs = FILES.flatMap(load)

// Palavras comuns do inglês que não existem em português (sem "a", "do", "come", "after" etc. que confundem).
const ENGLISH = new Set(
  'the and of with that this was were said you your what which would could should there their they them have has had from into upon then than when where while been being will shall not but she her his him its it\'s yes no little great very well why who whom'.split(' '),
)
// Nomes que podem aparecer de dois jeitos: o preferido primeiro.
const NAMES = [
  ['Totó', 'Toto'],
  ['Dorothy', 'Dorotéia', 'Doroti'],
  ['Espantalho', 'Espantalhos'],
  ['Lenhador de Lata', 'Homem de Lata', 'Lenhador de lata'],
  ['Leão Covarde', 'Leão covarde'],
  ['Cabeça-de-Abóbora', 'Cabeça de Abóbora', 'Cabeça-de-abóbora'],
  ['Munchkins', 'Munchkin', 'Muchkins'],
  ['Winkies', 'Winkie'],
  ['Quadlings', 'Quadling'],
  ['Gillikins', 'Gillikin', 'Gilikins'],
  ['Cidade das Esmeraldas', 'Cidade Esmeralda', 'Cidade de Esmeralda'],
  ['Tia Em', 'tia Em'],
  ['Tio Henry', 'tio Henry', 'Tio Henrique'],
  ['Glinda', 'Glynda'],
  ['Mombi', 'Mômbi'],
  ['Ozma', 'Osma'],
  ['Jack Cabeça-de-Abóbora', 'Jack Cabeça de Abóbora'],
]

const issues = { ingles: [], nomes: [], pontuacao: [], repetidas: [] }
const words = (t) => t.toLowerCase().match(/[\p{L}']+/gu) ?? []

for (const p of paragraphs) {
  // Inglês: duas ou mais palavras da lista no mesmo parágrafo, ou uma sequência "the X".
  const en = words(p.text).filter((w) => ENGLISH.has(w))
  if (en.length >= 2 || /(?<![\p{L}])(the|and|of)\s+[a-z]+/iu.test(p.text)) {
    const hits = [...new Set(en)].filter((w) => !['no', 'a', 'e'].includes(w))
    if (hits.length) issues.ingles.push({ where: p.where, hits, text: p.text.slice(0, 120) })
  }
  // Pontuação: aspas retas, hífen no lugar do travessão, dois espaços, espaço antes de pontuação.
  const punct = []
  // O texto usa aspas retas em todo lugar (é o padrão dele). Avisa só quando ficam sem par: número ímpar num
  // parágrafo que não é continuação de uma fala longa (essas abrem cada parágrafo e só fecham no último).
  const quotes = (p.text.match(/"/g) ?? []).length
  if (quotes % 2 === 1 && !p.text.startsWith('"') && !p.text.trimEnd().endsWith('"')) punct.push('aspas sem par')
  if (/(^|\s)-\s/.test(p.text)) punct.push('hífen solto no lugar de travessão ( - )')
  if (/--/.test(p.text)) punct.push('dois hífens (--)')
  if (/ {2,}/.test(p.text)) punct.push('dois espaços')
  if (/\s[,.;:!?](?!\.)/.test(p.text)) punct.push('espaço antes da pontuação')
  if (/—\S/.test(p.text.replace(/—[,.;:!?]/g, '')) && /^—\S/.test(p.text)) punct.push('travessão de fala sem espaço depois')
  if (punct.length) issues.pontuacao.push({ where: p.where, problems: punct, text: p.text.slice(0, 120) })
}

// Nomes de dois jeitos (conta cada forma; avisa quando a forma não preferida aparece).
for (const [prefer, ...others] of NAMES) {
  const count = (form) => paragraphs.reduce((n, p) => n + (p.text.match(new RegExp(`(?<![\\p{L}])${form}(?![\\p{L}])`, 'gu'))?.length ?? 0), 0)
  const variants = others.map((f) => [f, count(f)]).filter(([, n]) => n > 0)
  if (variants.length) issues.nomes.push({ prefer, preferCount: count(prefer), variants: Object.fromEntries(variants) })
}

// Frases repetidas.
const seen = new Map()
for (const p of paragraphs)
  for (const s of p.text.split(/(?<=[.!?…])\s+/)) {
    const k = s.trim()
    if (k.length < 40) continue
    seen.set(k, [...(seen.get(k) ?? []), p.where])
  }
for (const [s, where] of seen) if (where.length > 1) issues.repetidas.push({ text: s, where })

if (process.argv.includes('--json')) console.log(JSON.stringify(issues, null, 2))
else {
  const n = (k) => issues[k].length
  console.log(`Parágrafos lidos: ${paragraphs.length}`)
  console.log(`Inglês: ${n('ingles')} · Nomes de dois jeitos: ${n('nomes')} · Pontuação: ${n('pontuacao')} · Frases repetidas: ${n('repetidas')}`)
  for (const [k, list] of Object.entries(issues)) {
    if (!list.length) continue
    console.log(`\n## ${k}`)
    for (const it of list.slice(0, 40)) console.log('-', JSON.stringify(it))
    if (list.length > 40) console.log(`… e mais ${list.length - 40}`)
  }
}
