import { formatYear } from '../model/labels'
import type { ContinuityAnswer, Universe } from '../model/schema'
import { byId, entityName, manuscriptOrder } from '../model/universe'
import { daysInYear } from './calendar'
import { MentionMatcher } from './detection'
import { unmarkReveals } from './reveals'
import { fold } from './text'

export type QuestionType =
  | 'presenca-dupla'
  | 'apos-fim'
  | 'antes-inicio'
  | 'fatos-divergentes'
  | 'descricao-divergente'
  | 'morto-reaparece'
  | 'nome-parecido'
  | 'data-impossivel'

export interface Question {
  /** Assinatura estável: a mesma pergunta mantém a mesma resposta. */
  key: string
  type: QuestionType
  /** Cena onde a pergunta aparece (se houver). */
  sceneId: string | null
  sceneIds: string[]
  entityId: string | null
  factIds: string[]
  text: string
  answer?: ContinuityAnswer
}

export type QuestionToggles = Partial<Record<QuestionType, boolean>>

/**
 * Perguntas de continuidade a partir do que o autor registrou. São perguntas,
 * não erros: mistérios, magia e contradições propositais são permitidos.
 * Tipos desligados nas configurações não são gerados.
 */
export function continuityQuestions(universe: Universe, toggles: QuestionToggles = {}): Question[] {
  const on = (t: QuestionType) => toggles[t] !== false
  const suffix = universe.settings.calendarSuffix
  const answers = new Map(universe.continuity.map((a) => [a.key, a]))
  const out: Question[] = []
  const scenes = manuscriptOrder(universe)

  if (on('presenca-dupla')) {
    // Lugar dentro de lugar (a rua fica na vila) não é estar em dois lugares.
    const ancestors = (id: string) => {
      const out = new Set<string>()
      for (let e = byId(universe, 'entities', id); e?.parentId && !out.has(e.parentId); e = byId(universe, 'entities', e.parentId)) out.add(e.parentId)
      return out
    }
    const nested = (a: string, b: string) => ancestors(a).has(b) || ancestors(b).has(a)
    const dated = scenes.filter((s) => s.date && s.date.day !== null && s.placeId)
    for (let i = 0; i < dated.length; i++) {
      for (let j = i + 1; j < dated.length; j++) {
        const a = dated[i]
        const b = dated[j]
        if (a.date!.year !== b.date!.year || a.date!.day !== b.date!.day || a.placeId === b.placeId || nested(a.placeId!, b.placeId!)) continue
        // Só pessoas: grupos (a câmara, uma facção) podem estar em vários lugares.
        for (const id of a.presentIds.filter((x) => b.presentIds.includes(x) && byId(universe, 'entities', x)?.kind === 'personagem')) {
          out.push({
            key: `presenca-dupla:${[a.id, b.id].sort().join('+')}:${id}`,
            type: 'presenca-dupla',
            sceneId: b.id,
            sceneIds: [a.id, b.id],
            entityId: id,
            factIds: [],
            text: `${entityName(universe, id)} está em ${entityName(universe, a.placeId)} em “${a.title}” e em ${entityName(universe, b.placeId)} em “${b.title}”, no mesmo dia. Viajou, ou é outra pessoa?`,
          })
        }
      }
    }
  }

  for (const scene of scenes) {
    if (!scene.date) continue
    const year = scene.date.year
    const involved = new Set([...scene.presentIds, scene.povId, scene.placeId].filter(Boolean) as string[])
    for (const id of involved) {
      const e = byId(universe, 'entities', id)
      if (!e) continue
      const isPlace = id === scene.placeId
      if (on('apos-fim') && e.endYear !== null && year > e.endYear) {
        out.push({
          key: `apos-fim:${scene.id}:${id}`,
          type: 'apos-fim',
          sceneId: scene.id,
          sceneIds: [scene.id],
          entityId: id,
          factIds: [],
          text: isPlace
            ? `“${scene.title}” se passa em ${e.name} em ${formatYear(year, suffix)}, mas a ficha diz que o lugar deixou de existir em ${formatYear(e.endYear, suffix)}. Ruínas, memória ou engano?`
            : `${e.name} aparece em “${scene.title}” (${formatYear(year, suffix)}), mas a ficha registra o fim em ${formatYear(e.endYear, suffix)}. Flashback, fantasma, ou a data mudou?`,
        })
      }
      if (on('antes-inicio') && e.startYear !== null && year < e.startYear) {
        out.push({
          key: `antes-inicio:${scene.id}:${id}`,
          type: 'antes-inicio',
          sceneId: scene.id,
          sceneIds: [scene.id],
          entityId: id,
          factIds: [],
          text: `${e.name} aparece em “${scene.title}” (${formatYear(year, suffix)}), antes do início registrado na ficha (${formatYear(e.startYear, suffix)}). É intencional?`,
        })
      }
    }
  }

  if (on('fatos-divergentes')) {
    const groups = new Map<string, typeof universe.facts>()
    for (const f of universe.facts) {
      if (!f.subjectId || !f.predicate.trim()) continue
      const k = `${f.subjectId}|${fold(f.predicate.trim())}`
      groups.set(k, [...(groups.get(k) ?? []), f])
    }
    for (const facts of groups.values()) {
      const established = facts.filter((f) => f.canon === 'estabelecido')
      const values = new Set(established.map((f) => f.objectId ?? fold(f.value.trim())))
      if (values.size < 2) continue
      const ids = established.map((f) => f.id).sort()
      const f = established[0]
      out.push({
        key: `fatos-divergentes:${ids.join('+')}`,
        type: 'fatos-divergentes',
        sceneId: null,
        sceneIds: established.map((x) => x.sourceSceneId).filter(Boolean) as string[],
        entityId: f.subjectId,
        factIds: ids,
        text: `Há ${established.length} fatos estabelecidos diferentes para “${entityName(universe, f.subjectId)} ${f.predicate}”. Um deles é rumor, mentira ou mudou com o tempo?`,
      })
    }
  }

  if (on('descricao-divergente')) out.push(...descriptionQuestions(universe, scenes))
  if (on('morto-reaparece')) out.push(...deathQuestions(universe, scenes))
  if (on('nome-parecido')) out.push(...nameQuestions(universe, scenes))
  if (on('data-impossivel')) out.push(...dateQuestions(universe, scenes))

  return out.map((q) => ({ ...q, answer: answers.get(q.key) }))
}

type Scenes = ReturnType<typeof manuscriptOrder>

// ─── Olhos e cabelo que mudam de cor ─────────────────────────────────

const COLORS: [RegExp, string][] = [
  [/^azu(l|is)$/, 'azuis'],
  [/^verdes?$/, 'verdes'],
  [/^castanh[oa]s?$/, 'castanhos'],
  [/^(negr|pret)[oa]s?$/, 'pretos'],
  [/^(cinzent[oa]s?|cinzas?)$/, 'cinzentos'],
  [/^(ruiv[oa]s?|vermelh[oa]s?)$/, 'ruivos'],
  [/^(loir|lour)[oa]s?$/, 'loiros'],
  [/^grisalh[oa]s?$/, 'grisalhos'],
  [/^brancos?$/, 'brancos'],
  [/^(mel|ambar)$/, 'cor de mel'],
]
const colorOf = (word: string): string | null => COLORS.find(([re]) => re.test(word))?.[1] ?? null
const ATTRS: [RegExp, string, (name: string) => string][] = [
  [/^olhos?$/, 'olhos', (n) => `Os olhos de ${n} aparecem`],
  [/^cabel(o|os|eira)$/, 'cabelo', (n) => `O cabelo de ${n} aparece`],
]

/** Cor descrita logo depois de "olhos"/"cabelo" (até duas palavras entre eles: "olhos muito azuis"). */
function colorsIn(folded: string): { attr: string; color: string; at: number }[] {
  const out: { attr: string; color: string; at: number }[] = []
  const words = [...folded.matchAll(/[a-z]+/g)]
  words.forEach((w, i) => {
    const attr = ATTRS.find(([re]) => re.test(w[0]))
    if (!attr) return
    for (let j = i + 1; j <= i + 3 && j < words.length; j++) {
      const c = colorOf(words[j][0])
      if (c) {
        out.push({ attr: attr[1], color: c, at: w.index })
        return
      }
    }
  })
  return out
}

function descriptionQuestions(universe: Universe, scenes: Scenes): Question[] {
  const people = universe.entities.filter((e) => e.kind === 'personagem')
  if (!people.length) return []
  const matcher = new MentionMatcher(people)
  // entidade|atributo → cor → onde aparece
  const seen = new Map<string, Map<string, { sceneId: string | null; where: string }>>()
  const note = (entityId: string, attr: string, color: string, sceneId: string | null, where: string) => {
    const k = `${entityId}|${attr}`
    const m = seen.get(k) ?? new Map()
    if (!m.has(color)) m.set(color, { sceneId, where })
    seen.set(k, m)
  }
  for (const e of people) {
    for (const f of e.fields) {
      const key = fold(f.key)
      const attr = ATTRS.find(([re]) => key.split(/\s+/).some((w) => re.test(w)))
      if (!attr) continue
      const color = fold(unmarkReveals(f.value)).match(/[a-z]+/g)?.map(colorOf).find(Boolean)
      if (color) note(e.id, attr[1], color, null, 'na ficha')
    }
  }
  for (const s of scenes) {
    const folded = fold(s.text)
    // Frase a frase: a cor vale para a pessoa citada na mesma frase (só quando há uma).
    for (const sentence of folded.split(/(?<=[.!?…])\s+/)) {
      const ids = [...new Set(matcher.find(sentence).map((m) => m.entityId))]
      if (ids.length === 1) for (const c of colorsIn(sentence)) note(ids[0], c.attr, c.color, s.id, `em “${s.title || 'Sem título'}”`)
    }
  }
  const out: Question[] = []
  for (const [k, colors] of seen) {
    if (colors.size < 2) continue
    const [entityId, attr] = k.split('|')
    const said = ATTRS.find(([, a]) => a === attr)![2]
    const list = [...colors.entries()]
    const desc = list.map(([c, w]) => `${c} ${w.where}`).join(', ')
    out.push({
      key: `descricao-divergente:${entityId}:${attr}:${list.map(([c]) => c).sort().join('+')}`,
      type: 'descricao-divergente',
      sceneId: list.find(([, w]) => w.sceneId)?.[1].sceneId ?? null,
      sceneIds: list.map(([, w]) => w.sceneId).filter((x): x is string => Boolean(x)),
      entityId,
      factIds: [],
      text: `${said(entityName(universe, entityId))} de jeitos diferentes: ${desc}. Mudou com o tempo, é disfarce, ou é engano?`,
    })
  }
  return out
}

// ─── Morreu, e aparece de novo ───────────────────────────────────────

const DEATH = /^(morre|morreu|faleceu|foi mort[oa]|esta mort[oa]|morto|morta)/

function deathQuestions(universe: Universe, scenes: Scenes): Question[] {
  const out: Question[] = []
  const order = new Map(scenes.map((s, i) => [s.id, i]))
  for (const f of universe.facts) {
    if (!f.subjectId || !f.sourceSceneId || f.canon !== 'estabelecido') continue
    const said = fold(`${f.predicate} ${f.value}`.trim())
    if (!DEATH.test(said) && !/\bmort[oa]\b/.test(said)) continue
    const from = order.get(f.sourceSceneId)
    if (from === undefined) continue
    const died = scenes[from]
    for (const s of scenes.slice(from + 1)) {
      if (!s.presentIds.includes(f.subjectId) && s.povId !== f.subjectId) continue
      out.push({
        key: `morto-reaparece:${f.id}:${s.id}`,
        type: 'morto-reaparece',
        sceneId: s.id,
        sceneIds: [died.id, s.id],
        entityId: f.subjectId,
        factIds: [f.id],
        text: `${entityName(universe, f.subjectId)} morre em “${died.title || 'Sem título'}”, mas está em “${s.title || 'Sem título'}”, depois. Lembrança, fantasma, ou a morte foi falsa?`,
      })
    }
  }
  return out
}

// ─── Nome escrito quase igual ────────────────────────────────────────

/** Distância de edição pequena (para por volta de `max`). */
function near(a: string, b: string, max: number): boolean {
  if (Math.abs(a.length - b.length) > max) return false
  // Duas letras vizinhas trocadas ("Kale" por "Kael") contam como um erro só.
  if (a.length === b.length) {
    const diff = [...a].flatMap((c, i) => (c === b[i] ? [] : [i]))
    if (diff.length === 2 && diff[1] === diff[0] + 1 && a[diff[0]] === b[diff[1]] && a[diff[1]] === b[diff[0]]) return true
  }
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    let best = i
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
      best = Math.min(best, cur[j])
    }
    if (best > max) return false
    prev = cur
  }
  return prev[b.length] <= max
}

function nameQuestions(universe: Universe, scenes: Scenes): Question[] {
  // Palavras dos nomes (4+ letras), e quantas vezes cada palavra com maiúscula aparece no texto.
  const nameWords = new Map<string, string>()
  // De pessoas, todas as palavras do nome (Simão, Bacamarte); de lugares e grupos, só a primeira ("Casa Verde" → Casa).
  for (const e of universe.entities)
    for (const n of [e.name, ...e.aliases]) {
      const words = n.split(/[^\p{L}]+/u).filter((w) => w.length >= 4)
      for (const w of e.kind === 'personagem' ? words : words.slice(0, 1)) nameWords.set(fold(w), e.id)
    }
  if (!nameWords.size) return []
  const counts = new Map<string, { n: number; form: string; sceneId: string }>()
  // Palavras que aparecem em minúscula são palavras comuns ("cada", "casa"), não nomes.
  const lower = new Set<string>()
  for (const s of scenes) for (const m of s.text.matchAll(/(?<![\p{L}])\p{Ll}[\p{L}]{3,}/gu)) lower.add(fold(m[0]))
  for (const s of scenes) {
    for (const m of s.text.matchAll(/(?<![\p{L}])\p{Lu}[\p{L}]{3,}/gu)) {
      const k = fold(m[0])
      const c = counts.get(k)
      if (c) c.n++
      else counts.set(k, { n: 1, form: m[0], sceneId: s.id })
    }
  }
  const out: Question[] = []
  for (const [k, c] of counts) {
    if (nameWords.has(k) || c.n > 2 || lower.has(k)) continue
    for (const [w, entityId] of nameWords) {
      const used = counts.get(w)?.n ?? 0
      // Plural do nome ("os Bacamartes") não é erro.
      if (used < 3 || lower.has(w) || k === `${w}s` || k === `${w}es` || !near(k, w, w.length >= 8 ? 2 : 1)) continue
      const scene = scenes.find((s) => s.id === c.sceneId)
      const right = universe.entities.find((e) => e.id === entityId)
      const shown = [right?.name ?? '', ...(right?.aliases ?? [])].flatMap((n) => n.split(/[^\p{L}]+/u)).find((x) => fold(x) === w) ?? w
      out.push({
        key: `nome-parecido:${k}:${entityId}`,
        type: 'nome-parecido',
        sceneId: c.sceneId,
        sceneIds: [c.sceneId],
        entityId,
        factIds: [],
        text: `“${c.form}” aparece ${c.n === 1 ? 'uma vez' : 'duas vezes'}${scene ? ` (em “${scene.title || 'Sem título'}”)` : ''}, e “${shown}”, ${used} vezes. Erro de digitação, ou é outro nome?`,
      })
      break
    }
  }
  return out
}

// ─── Datas impossíveis ───────────────────────────────────────────────

function dateQuestions(universe: Universe, scenes: Scenes): Question[] {
  const suffix = universe.settings.calendarSuffix
  const out: Question[] = []
  for (const e of universe.entities) {
    if (e.startYear !== null && e.endYear !== null && e.endYear < e.startYear)
      out.push({ key: `data-impossivel:ficha:${e.id}`, type: 'data-impossivel', sceneId: null, sceneIds: [], entityId: e.id, factIds: [], text: `A ficha de ${e.name} termina em ${formatYear(e.endYear, suffix)}, antes de começar (${formatYear(e.startYear, suffix)}).` })
  }
  for (const ev of universe.events) {
    if (ev.endYear !== null && ev.endYear < ev.year)
      out.push({ key: `data-impossivel:evento:${ev.id}`, type: 'data-impossivel', sceneId: null, sceneIds: [], entityId: null, factIds: [], text: `“${ev.title}” termina em ${formatYear(ev.endYear, suffix)}, antes de começar (${formatYear(ev.year, suffix)}).` })
  }
  const total = daysInYear(universe.settings.calendarMonths)
  if (total)
    for (const s of scenes) {
      const day = s.date?.day
      if (day != null && (day < 1 || day > total))
        out.push({ key: `data-impossivel:cena:${s.id}`, type: 'data-impossivel', sceneId: s.id, sceneIds: [s.id], entityId: null, factIds: [], text: `“${s.title || 'Sem título'}” está no dia ${day} do ano, mas o calendário tem ${total} dias.` })
    }
  return out
}

/** Perguntas ainda em aberto (sem resposta ou adiadas). */
export const isOpen = (q: Question) => !q.answer || q.answer.answer === 'depois'
